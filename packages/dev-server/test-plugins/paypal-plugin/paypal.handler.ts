import {
    CreatePaymentResult,
    LanguageCode,
    Logger,
    PaymentMethodHandler,
    SettlePaymentErrorResult,
    SettlePaymentResult,
} from '@vendure/core';
import { CheckoutPaymentIntent } from '@paypal/paypal-server-sdk';

import { loggerCtx, PAYPAL_PAYMENT_HANDLER_CODE } from './constants';
import { PayPalService } from './paypal.service';
import { PayPalPaymentMetadata } from './types';

let paypalService: PayPalService;

/**
 * @description
 * The PayPal {@link PaymentMethodHandler}. It supports both the standard checkout (immediate
 * capture, Use Case 1) and the authorize-then-capture (Use Case 2) flows. The behaviour is driven
 * by the `intent` the PayPal order was created with via the `createPayPalCheckout` Shop API
 * mutation, which is read back from PayPal so the handler never has to trust client input:
 *
 *  - **CAPTURE**: {@link createPayment} captures the funds immediately and the Vendure Payment is
 *    settled in one step; {@link settlePayment} is then a no-op.
 *  - **AUTHORIZE**: {@link createPayment} only authorizes (reserves) the funds and the Payment is
 *    created in the `Authorized` state; {@link settlePayment} later captures the authorization (for
 *    example, just before shipment).
 *
 * In both flows the approved PayPal order ID must be supplied as `metadata.paypalOrderId` to the
 * `addPaymentToOrder` mutation.
 */
export const paypalPaymentHandler = new PaymentMethodHandler({
    code: PAYPAL_PAYMENT_HANDLER_CODE,
    description: [{ languageCode: LanguageCode.en, value: 'PayPal' }],
    args: {},
    init(injector) {
        paypalService = injector.get(PayPalService);
    },
    async createPayment(ctx, order, amount, _args, metadata): Promise<CreatePaymentResult> {
        const paypalOrderId = (metadata as Partial<PayPalPaymentMetadata>).paypalOrderId;
        if (typeof paypalOrderId !== 'string' || paypalOrderId.length === 0) {
            throw new Error(
                'Missing `paypalOrderId` in payment metadata. The storefront must create a PayPal ' +
                    'order via the `createPayPalCheckout` mutation and pass the approved order ID ' +
                    'in the `addPaymentToOrder` metadata.',
            );
        }
        try {
            const intent = await paypalService.getOrderIntent(paypalOrderId);
            if (intent === CheckoutPaymentIntent.Authorize) {
                // Use Case 2: reserve the funds now, capture later during settlePayment.
                const authorization = await paypalService.authorizeApprovedOrder(
                    ctx,
                    order,
                    paypalOrderId,
                    amount,
                );
                const authorizeMetadata: PayPalPaymentMetadata = {
                    paypalOrderId,
                    intent: 'AUTHORIZE',
                    authorizationId: authorization.authorizationId,
                    status: authorization.status,
                };
                return {
                    amount: authorization.authorizedMinorUnits,
                    state: 'Authorized',
                    transactionId: authorization.authorizationId,
                    metadata: authorizeMetadata,
                };
            }

            // Use Case 1: capture immediately.
            const capture = await paypalService.captureApprovedOrder(ctx, order, paypalOrderId, amount);
            const captureMetadata: PayPalPaymentMetadata = {
                paypalOrderId,
                intent: 'CAPTURE',
                captureId: capture.captureId,
                status: capture.status,
            };
            return {
                amount: capture.capturedMinorUnits,
                state: 'Settled',
                transactionId: capture.captureId,
                metadata: captureMetadata,
            };
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            Logger.warn(
                `PayPal payment for order ${order.code} was declined: ${errorMessage}`,
                loggerCtx,
            );
            return {
                amount,
                state: 'Declined',
                errorMessage,
                metadata: { paypalOrderId } satisfies PayPalPaymentMetadata,
            };
        }
    },
    async settlePayment(
        ctx,
        order,
        payment,
    ): Promise<SettlePaymentResult | SettlePaymentErrorResult> {
        const metadata = (payment.metadata ?? {}) as Partial<PayPalPaymentMetadata>;
        // Standard checkout (CAPTURE) payments are already settled during createPayment.
        if (!metadata.authorizationId) {
            return { success: true };
        }
        // Authorize-then-capture (AUTHORIZE) payments are captured here.
        try {
            const capture = await paypalService.captureAuthorization(
                ctx,
                order,
                metadata.authorizationId,
                payment.amount,
            );
            return {
                success: true,
                metadata: {
                    ...metadata,
                    captureId: capture.captureId,
                    status: capture.status,
                },
            };
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            Logger.warn(
                `Failed to capture PayPal authorization for order ${order.code}: ${errorMessage}`,
                loggerCtx,
            );
            return { success: false, errorMessage };
        }
    },
});
