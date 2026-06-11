import { Inject, Injectable } from '@nestjs/common';
import {
    ActiveOrderService,
    ID,
    Logger,
    Order,
    OrderService,
    RequestContext,
    UserInputError,
} from '@vendure/core';
import {
    ApiError,
    CheckoutPaymentIntent,
    OrderRequest,
    OrderStatus,
    PaypalExperienceUserAction,
    PaypalWalletContextShippingPreference,
} from '@paypal/paypal-server-sdk';

import { loggerCtx, PAYPAL_PLUGIN_OPTIONS } from './constants';
import { fromPayPalAmount, toPayPalAmount } from './paypal-amount';
import { PayPalClientService } from './paypal.client';
import { PayPalPluginOptions } from './types';

/**
 * The result of creating a PayPal checkout (order) for the buyer to approve.
 */
export interface PayPalCheckoutResult {
    /** The PayPal order ID. Pass this back to `addPaymentToOrder` once the buyer has approved. */
    id: string;
    /** The PayPal order status, e.g. `CREATED`. */
    status: string;
    /** The URL to redirect the buyer to in order to approve the payment (redirect flow). */
    approveUrl?: string;
}

/**
 * The result of capturing an approved PayPal order.
 */
export interface PayPalCaptureResult {
    /** The PayPal capture ID. */
    captureId: string;
    /** The PayPal capture status, e.g. `COMPLETED`. */
    status: string;
    /** The captured amount in Vendure integer minor units. */
    capturedMinorUnits: number;
}

/**
 * @description
 * Encapsulates all interaction with the PayPal Orders API for the standard checkout (immediate
 * capture) flow:
 *
 *  - {@link createCheckout} creates a PayPal order with `CAPTURE` intent for the active Vendure
 *    order and returns the buyer approval URL.
 *  - {@link captureApprovedOrder} captures the funds once the buyer has approved, and is invoked by
 *    the PayPal {@link PaymentMethodHandler} during `addPaymentToOrder`.
 */
@Injectable()
export class PayPalService {
    constructor(
        private readonly clientService: PayPalClientService,
        private readonly activeOrderService: ActiveOrderService,
        private readonly orderService: OrderService,
        @Inject(PAYPAL_PLUGIN_OPTIONS) private readonly options: PayPalPluginOptions,
    ) {}

    /**
     * Creates a PayPal order (intent `CAPTURE`) for the buyer's active Vendure order and returns the
     * approval URL. The PayPal order amount is set to the Vendure order's outstanding total.
     */
    async createCheckout(
        ctx: RequestContext,
        input: { orderId?: ID; returnUrl?: string; cancelUrl?: string },
    ): Promise<PayPalCheckoutResult> {
        const order = await this.resolveOrder(ctx, input.orderId);
        if (order.totalWithTax <= 0) {
            throw new UserInputError(`Order ${order.code} has no outstanding amount to pay`);
        }

        const { returnUrl: defaultReturnUrl, cancelUrl: defaultCancelUrl } =
            this.clientService.getRedirectUrls();
        const returnUrl = input.returnUrl ?? defaultReturnUrl;
        const cancelUrl = input.cancelUrl ?? defaultCancelUrl;
        if (!returnUrl || !cancelUrl) {
            // Without a return_url, PayPal has nowhere to send the buyer after they approve the
            // payment, which makes the approval page spin/hang indefinitely in the redirect flow.
            Logger.warn(
                `Creating PayPal order for ${order.code} without a ${
                    !returnUrl ? 'return' : 'cancel'
                } URL. This is only safe for the embedded (JS SDK) flow; the redirect flow will ` +
                    'hang after approval. Configure `returnUrl`/`cancelUrl` on PayPalPlugin.init() ' +
                    'or pass them to the createPayPalCheckout mutation.',
                loggerCtx,
            );
        }

        // Use the modern `payment_source.paypal.experience_context` (the `application_context`
        // object is deprecated and its return_url is increasingly ignored by PayPal).
        const body: OrderRequest = {
            intent: CheckoutPaymentIntent.Capture,
            purchaseUnits: [
                {
                    referenceId: 'default',
                    customId: order.code,
                    amount: {
                        currencyCode: order.currencyCode,
                        value: toPayPalAmount(order.totalWithTax, order.currencyCode),
                    },
                },
            ],
            paymentSource: {
                paypal: {
                    experienceContext: {
                        brandName: this.clientService.getBrandName(),
                        userAction: PaypalExperienceUserAction.PayNow,
                        shippingPreference: PaypalWalletContextShippingPreference.NoShipping,
                        ...(returnUrl ? { returnUrl } : {}),
                        ...(cancelUrl ? { cancelUrl } : {}),
                    },
                },
            },
        };

        try {
            const { result } = await this.clientService.getOrdersController().createOrder({
                body,
                prefer: 'return=representation',
            });
            if (!result.id) {
                throw new Error('PayPal did not return an order ID');
            }
            const approveUrl = result.links?.find(
                link => link.rel === 'approve' || link.rel === 'payer-action',
            )?.href;
            Logger.info(
                `Created PayPal order ${result.id} for Vendure order ${order.code}`,
                loggerCtx,
            );
            return {
                id: result.id,
                status: result.status ?? OrderStatus.Created,
                approveUrl,
            };
        } catch (e) {
            throw this.toReadableError(e, `create PayPal order for ${order.code}`);
        }
    }

    /**
     * Captures payment for a previously-approved PayPal order. Verifies the captured amount matches
     * the expected Vendure amount and returns the capture details for storage on the Payment.
     *
     * @param expectedMinorUnits The amount Vendure expects to be captured, in integer minor units.
     */
    async captureApprovedOrder(
        ctx: RequestContext,
        order: Order,
        paypalOrderId: string,
        expectedMinorUnits: number,
    ): Promise<PayPalCaptureResult> {
        let captured;
        try {
            const { result } = await this.clientService.getOrdersController().captureOrder({
                id: paypalOrderId,
                prefer: 'return=representation',
            });
            captured = result;
        } catch (e) {
            throw this.toReadableError(e, `capture PayPal order ${paypalOrderId}`);
        }

        if (captured.status !== OrderStatus.Completed) {
            throw new Error(
                `PayPal order ${paypalOrderId} could not be captured (status: ${
                    captured.status ?? 'UNKNOWN'
                })`,
            );
        }

        const capture = captured.purchaseUnits?.[0]?.payments?.captures?.[0];
        if (!capture?.id || !capture.amount) {
            throw new Error(`PayPal order ${paypalOrderId} returned no capture details`);
        }

        const capturedMinorUnits = fromPayPalAmount(capture.amount.value, capture.amount.currencyCode);
        if (capturedMinorUnits !== expectedMinorUnits) {
            throw new Error(
                `Captured amount (${capturedMinorUnits}) does not match the expected amount ` +
                    `(${expectedMinorUnits}) for order ${order.code}`,
            );
        }

        Logger.info(
            `Captured PayPal payment ${capture.id} for Vendure order ${order.code}`,
            loggerCtx,
        );
        return {
            captureId: capture.id,
            status: capture.status ?? captured.status,
            capturedMinorUnits,
        };
    }

    private async resolveOrder(ctx: RequestContext, orderId?: ID): Promise<Order> {
        const order = orderId
            ? await this.orderService.findOne(ctx, orderId)
            : await this.activeOrderService.getActiveOrder(ctx, undefined);
        if (!order) {
            throw new UserInputError('No active order found for the current session');
        }
        return order;
    }

    /**
     * Normalises errors thrown by the PayPal SDK into a single, logged Error with a clear message.
     * PayPal {@link ApiError}s carry an HTTP status code and a structured result body which are
     * preserved in the log for troubleshooting, while a concise message is surfaced to the caller.
     */
    private toReadableError(e: unknown, action: string): Error {
        if (e instanceof ApiError) {
            Logger.error(
                `PayPal API error while attempting to ${action} (status ${e.statusCode}): ${
                    e.message
                } | ${JSON.stringify(e.result)}`,
                loggerCtx,
            );
            return new Error(`Failed to ${action}: PayPal responded with status ${e.statusCode}`);
        }
        const message = e instanceof Error ? e.message : String(e);
        Logger.error(`Failed to ${action}: ${message}`, loggerCtx);
        return e instanceof Error ? e : new Error(message);
    }
}
