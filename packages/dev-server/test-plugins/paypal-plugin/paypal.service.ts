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
    AuthorizationStatus,
    CaptureStatus,
    CheckoutPaymentIntent,
    OrderRequest,
    OrderStatus,
    PaypalExperienceUserAction,
    PaypalWalletContextShippingPreference,
    RefundRequest,
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
 * The result of capturing an approved PayPal order (or a previously-created authorization).
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
 * The result of authorizing (reserving funds for) an approved PayPal order.
 */
export interface PayPalAuthorizeResult {
    /** The PayPal authorization ID. Required to later capture or void the authorization. */
    authorizationId: string;
    /** The PayPal authorization status, e.g. `CREATED`. */
    status: string;
    /** The authorized amount in Vendure integer minor units. */
    authorizedMinorUnits: number;
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
     * Creates a PayPal order for the buyer's active Vendure order and returns the approval URL.
     * The PayPal order amount is set to the Vendure order's outstanding total.
     *
     * The `intent` controls the flow: `CAPTURE` (default) captures funds immediately when the
     * payment is added to the order (Use Case 1); `AUTHORIZE` only reserves the funds, which are
     * later captured when the Vendure payment is settled (Use Case 2).
     */
    async createCheckout(
        ctx: RequestContext,
        input: {
            orderId?: ID;
            intent?: 'CAPTURE' | 'AUTHORIZE';
            returnUrl?: string;
            cancelUrl?: string;
        },
    ): Promise<PayPalCheckoutResult> {
        const order = await this.resolveOrder(ctx, input.orderId);
        if (order.totalWithTax <= 0) {
            throw new UserInputError(`Order ${order.code} has no outstanding amount to pay`);
        }
        const intent =
            input.intent === 'AUTHORIZE'
                ? CheckoutPaymentIntent.Authorize
                : CheckoutPaymentIntent.Capture;

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
            intent,
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

    /**
     * Looks up the `intent` (`CAPTURE` or `AUTHORIZE`) that a PayPal order was created with. The
     * PayPal order is the single source of truth, so the handler does not have to trust a
     * client-supplied value when deciding whether to capture or authorize.
     */
    async getOrderIntent(paypalOrderId: string): Promise<CheckoutPaymentIntent> {
        try {
            const { result } = await this.clientService
                .getOrdersController()
                .getOrder({ id: paypalOrderId });
            return result.intent ?? CheckoutPaymentIntent.Capture;
        } catch (e) {
            throw this.toReadableError(e, `read PayPal order ${paypalOrderId}`);
        }
    }

    /**
     * Authorizes (reserves funds for) a previously-approved PayPal order without capturing. Verifies
     * the authorized amount matches the expected Vendure amount and returns the authorization
     * details for storage on the Payment.
     *
     * @param expectedMinorUnits The amount Vendure expects to be authorized, in integer minor units.
     */
    async authorizeApprovedOrder(
        ctx: RequestContext,
        order: Order,
        paypalOrderId: string,
        expectedMinorUnits: number,
    ): Promise<PayPalAuthorizeResult> {
        let authorized;
        try {
            const { result } = await this.clientService.getOrdersController().authorizeOrder({
                id: paypalOrderId,
                prefer: 'return=representation',
            });
            authorized = result;
        } catch (e) {
            throw this.toReadableError(e, `authorize PayPal order ${paypalOrderId}`);
        }

        const authorization = authorized.purchaseUnits?.[0]?.payments?.authorizations?.[0];
        if (!authorization?.id || !authorization.amount) {
            throw new Error(`PayPal order ${paypalOrderId} returned no authorization details`);
        }
        if (
            authorization.status !== AuthorizationStatus.Created &&
            authorization.status !== AuthorizationStatus.Pending
        ) {
            throw new Error(
                `PayPal order ${paypalOrderId} could not be authorized (authorization status: ${
                    authorization.status ?? 'UNKNOWN'
                })`,
            );
        }

        const authorizedMinorUnits = fromPayPalAmount(
            authorization.amount.value,
            authorization.amount.currencyCode,
        );
        if (authorizedMinorUnits !== expectedMinorUnits) {
            throw new Error(
                `Authorized amount (${authorizedMinorUnits}) does not match the expected amount ` +
                    `(${expectedMinorUnits}) for order ${order.code}`,
            );
        }

        Logger.info(
            `Authorized PayPal payment ${authorization.id} for Vendure order ${order.code}`,
            loggerCtx,
        );
        return {
            authorizationId: authorization.id,
            status: authorization.status,
            authorizedMinorUnits,
        };
    }

    /**
     * Captures a previously-created PayPal authorization in full (Use Case 2 settlement). Verifies
     * the captured amount matches the expected Vendure amount and returns the capture details.
     *
     * @param expectedMinorUnits The amount Vendure expects to be captured, in integer minor units.
     */
    async captureAuthorization(
        ctx: RequestContext,
        order: Order,
        authorizationId: string,
        expectedMinorUnits: number,
    ): Promise<PayPalCaptureResult> {
        let capture;
        try {
            const { result } = await this.clientService.getPaymentsController().captureAuthorizedPayment({
                authorizationId,
                prefer: 'return=representation',
            });
            capture = result;
        } catch (e) {
            throw this.toReadableError(e, `capture PayPal authorization ${authorizationId}`);
        }

        if (capture.status !== CaptureStatus.Completed) {
            throw new Error(
                `PayPal authorization ${authorizationId} could not be captured (status: ${
                    capture.status ?? 'UNKNOWN'
                })`,
            );
        }
        if (!capture.id || !capture.amount) {
            throw new Error(
                `PayPal authorization ${authorizationId} returned no capture details`,
            );
        }

        const capturedMinorUnits = fromPayPalAmount(capture.amount.value, capture.amount.currencyCode);
        if (capturedMinorUnits !== expectedMinorUnits) {
            throw new Error(
                `Captured amount (${capturedMinorUnits}) does not match the expected amount ` +
                    `(${expectedMinorUnits}) for order ${order.code}`,
            );
        }

        Logger.info(
            `Captured PayPal authorization ${authorizationId} as capture ${capture.id} for ` +
                `Vendure order ${order.code}`,
            loggerCtx,
        );
        return {
            captureId: capture.id,
            status: capture.status,
            capturedMinorUnits,
        };
    }

    /**
     * Voids (cancels) a previously-created PayPal authorization, releasing the reserved funds back
     * to the buyer (Use Case 3). Only authorizations that have not been fully captured can be
     * voided; PayPal rejects the call otherwise.
     *
     * @returns The PayPal authorization status after voiding (e.g. `VOIDED`), when returned.
     */
    async voidAuthorization(
        ctx: RequestContext,
        order: Order,
        authorizationId: string,
    ): Promise<{ status?: string }> {
        try {
            const { result } = await this.clientService.getPaymentsController().voidPayment({
                authorizationId,
                prefer: 'return=representation',
            });
            Logger.info(
                `Voided PayPal authorization ${authorizationId} for Vendure order ${order.code}`,
                loggerCtx,
            );
            return { status: result?.status };
        } catch (e) {
            throw this.toReadableError(e, `void PayPal authorization ${authorizationId}`);
        }
    }

    /**
     * Refunds a captured PayPal payment (Use Cases 4 & 5).
     *
     * When `fullRefund` is `true` the amount is omitted from the PayPal request, which refunds the
     * entire captured amount. Otherwise the specific `amountMinorUnits` is refunded, supporting
     * partial refunds (PayPal allows multiple partial refunds against the same capture, up to the
     * captured total).
     *
     * @returns The PayPal refund ID and status (e.g. `COMPLETED` or `PENDING`).
     */
    async refundCapture(
        ctx: RequestContext,
        order: Order,
        captureId: string,
        amountMinorUnits: number,
        options: { fullRefund: boolean },
    ): Promise<{ refundId: string; status: string }> {
        const body: RefundRequest = {};
        if (!options.fullRefund) {
            body.amount = {
                currencyCode: order.currencyCode,
                value: toPayPalAmount(amountMinorUnits, order.currencyCode),
            };
        }
        try {
            const { result } = await this.clientService.getPaymentsController().refundCapturedPayment({
                captureId,
                prefer: 'return=representation',
                body,
            });
            if (!result.id) {
                throw new Error('PayPal did not return a refund ID');
            }
            Logger.info(
                `Refunded ${options.fullRefund ? 'full' : amountMinorUnits.toString()} amount as ` +
                    `PayPal refund ${result.id} for Vendure order ${order.code}`,
                loggerCtx,
            );
            return { refundId: result.id, status: result.status ?? 'PENDING' };
        } catch (e) {
            throw this.toReadableError(e, `refund PayPal capture ${captureId}`);
        }
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
     * PayPal {@link ApiError}s carry an HTTP status code and a structured error body (`name`,
     * `message`, `details[].issue`/`description`, `debug_id`). We extract the specific issue so the
     * caller sees *why* PayPal rejected the request (e.g. `REFUND_FAILED_INSUFFICIENT_FUNDS`) rather
     * than just the HTTP status. The full body is also written to the log for troubleshooting.
     */
    private toReadableError(e: unknown, action: string): Error {
        if (e instanceof ApiError) {
            const rawBody = typeof e.body === 'string' ? e.body : JSON.stringify(e.result);
            Logger.error(
                `PayPal API error while attempting to ${action} (status ${e.statusCode}): ${
                    e.message
                } | ${rawBody}`,
                loggerCtx,
            );
            const detail = this.describePayPalError(e);
            return new Error(
                `Failed to ${action}: PayPal responded with status ${e.statusCode}` +
                    (detail ? ` — ${detail}` : ''),
            );
        }
        const message = e instanceof Error ? e.message : String(e);
        Logger.error(`Failed to ${action}: ${message}`, loggerCtx);
        return e instanceof Error ? e : new Error(message);
    }

    /**
     * Extracts a human-readable description from a PayPal error response. PayPal returns the error
     * envelope either as the parsed `result` or, when it does not match the endpoint's success
     * schema, as the raw JSON `body` string — both are handled here.
     */
    private describePayPalError(e: ApiError): string | undefined {
        let envelope: any = e.result;
        if ((!envelope || typeof envelope !== 'object') && typeof e.body === 'string') {
            try {
                envelope = JSON.parse(e.body);
            } catch {
                return undefined;
            }
        }
        if (!envelope || typeof envelope !== 'object') {
            return undefined;
        }
        const parts: string[] = [];
        if (Array.isArray(envelope.details) && envelope.details.length > 0) {
            for (const detail of envelope.details) {
                if (detail && typeof detail === 'object') {
                    const issue = typeof detail.issue === 'string' ? detail.issue : '';
                    const description =
                        typeof detail.description === 'string' ? detail.description : '';
                    const combined = [issue, description].filter(Boolean).join(': ');
                    if (combined) {
                        parts.push(combined);
                    }
                }
            }
        } else if (typeof envelope.message === 'string') {
            parts.push(envelope.message);
        }
        if (typeof envelope.debug_id === 'string') {
            parts.push(`debug_id=${envelope.debug_id}`);
        }
        return parts.length > 0 ? parts.join(' | ') : undefined;
    }
}
