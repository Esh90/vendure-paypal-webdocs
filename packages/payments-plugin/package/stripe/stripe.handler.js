"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripePaymentMethodHandler = void 0;
const core_1 = require("@vendure/core");
const stripe_1 = __importDefault(require("stripe"));
const stripe_utils_1 = require("./stripe-utils");
const stripe_service_1 = require("./stripe.service");
const { StripeError } = stripe_1.default.errors;
let stripeService;
/**
 * The handler for Stripe payments.
 */
exports.stripePaymentMethodHandler = new core_1.PaymentMethodHandler({
    code: 'stripe',
    description: [{ languageCode: core_1.LanguageCode.en, value: 'Stripe payments' }],
    args: {
        apiKey: {
            type: 'string',
            label: [{ languageCode: core_1.LanguageCode.en, value: 'API Key' }],
            ui: { component: 'password-form-input' },
        },
        webhookSecret: {
            type: 'string',
            label: [
                {
                    languageCode: core_1.LanguageCode.en,
                    value: 'Webhook secret',
                },
            ],
            description: [
                {
                    languageCode: core_1.LanguageCode.en,
                    value: 'Secret to validate incoming webhooks. Get this from your Stripe dashboard',
                },
            ],
            ui: { component: 'password-form-input' },
        },
    },
    init(injector) {
        stripeService = injector.get(stripe_service_1.StripeService);
    },
    createPayment(ctx, order, amount, ___, metadata) {
        // Payment is already settled in Stripe by the time the webhook in stripe.controller.ts
        // adds the payment to the order
        if (ctx.apiType !== 'admin') {
            throw Error(`CreatePayment is not allowed for apiType '${ctx.apiType}'`);
        }
        const amountInMinorUnits = (0, stripe_utils_1.getAmountFromStripeMinorUnits)(order, metadata.paymentIntentAmountReceived);
        return {
            amount: amountInMinorUnits,
            state: 'Settled',
            transactionId: metadata.paymentIntentId,
            metadata,
        };
    },
    settlePayment() {
        return {
            success: true,
        };
    },
    async createRefund(ctx, input, amount, order, payment, args) {
        // TODO: Consider passing the "reason" property once this feature request is addressed:
        // https://github.com/vendure-ecommerce/vendure/issues/893
        try {
            const refund = await stripeService.createRefund(ctx, order, payment, amount);
            if (refund.status === 'succeeded') {
                return {
                    state: 'Settled',
                    transactionId: payment.transactionId,
                };
            }
            if (refund.status === 'pending') {
                return {
                    state: 'Pending',
                    transactionId: payment.transactionId,
                };
            }
            return {
                state: 'Failed',
                transactionId: payment.transactionId,
                metadata: {
                    message: refund.failure_reason,
                },
            };
        }
        catch (e) {
            if (e instanceof StripeError) {
                return {
                    state: 'Failed',
                    transactionId: payment.transactionId,
                    metadata: {
                        type: e.type,
                        message: e.message,
                    },
                };
            }
            throw e;
        }
    },
});
//# sourceMappingURL=stripe.handler.js.map