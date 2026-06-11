import {
    CreatePaymentResult,
    LanguageCode,
    Logger,
    PaymentMethodHandler,
    SettlePaymentResult,
} from '@vendure/core';

import { loggerCtx, PAYPAL_PAYMENT_HANDLER_CODE } from './constants';
import { PayPalService } from './paypal.service';
import { PayPalPaymentMetadata } from './types';

let paypalService: PayPalService;

/**
 * @description
 * The PayPal {@link PaymentMethodHandler} for the standard checkout (immediate capture) flow.
 *
 * The buyer first approves a PayPal order created via the `createPayPalCheckout` Shop API mutation.
 * The approved PayPal order ID is then supplied as `metadata.paypalOrderId` to the
 * `addPaymentToOrder` mutation, at which point {@link createPayment} captures the funds and the
 * resulting Vendure Payment is settled in a single step. Consequently {@link settlePayment} is a
 * no-op that simply reports success.
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
            const capture = await paypalService.captureApprovedOrder(
                ctx,
                order,
                paypalOrderId,
                amount,
            );
            const paymentMetadata: PayPalPaymentMetadata = {
                paypalOrderId,
                captureId: capture.captureId,
                status: capture.status,
            };
            return {
                amount: capture.capturedMinorUnits,
                state: 'Settled',
                transactionId: capture.captureId,
                metadata: paymentMetadata,
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
    settlePayment(): SettlePaymentResult {
        // Payments are captured during `createPayment`, so they are already settled here.
        return { success: true };
    },
});
