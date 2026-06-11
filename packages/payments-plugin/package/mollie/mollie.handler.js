"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.molliePaymentHandler = void 0;
const api_client_1 = __importStar(require("@mollie/api-client"));
const generated_types_1 = require("@vendure/common/lib/generated-types");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const mollie_helpers_1 = require("./mollie.helpers");
const mollie_service_1 = require("./mollie.service");
let mollieService;
exports.molliePaymentHandler = new core_1.PaymentMethodHandler({
    code: 'mollie-payment-handler',
    description: [
        {
            languageCode: generated_types_1.LanguageCode.en,
            value: 'Mollie payment',
        },
    ],
    args: {
        apiKey: {
            type: 'string',
            label: [{ languageCode: generated_types_1.LanguageCode.en, value: 'API Key' }],
        },
        redirectUrl: {
            type: 'string',
            required: true,
            defaultValue: '',
            label: [{ languageCode: generated_types_1.LanguageCode.en, value: 'Fallback redirect URL' }],
            description: [
                {
                    languageCode: generated_types_1.LanguageCode.en,
                    value: 'Redirect URL to use when no URL is given by the storefront. Order code is appended to this URL',
                },
            ],
        },
    },
    init(injector) {
        mollieService = injector.get(mollie_service_1.MollieService);
    },
    createPayment: (ctx, order, _amount, // Don't use this amount, but the amount from the metadata, because that has the actual paid amount from Mollie
    args, _metadata) => {
        // Only Admins and internal calls should be allowed to settle and authorize payments
        if (ctx.apiType !== 'admin' && ctx.apiType !== 'custom') {
            throw Error(`CreatePayment is not allowed for apiType '${ctx.apiType}'`);
        }
        const mollieMetadata = _metadata;
        if (mollieMetadata.status !== 'Authorized' && mollieMetadata.status !== 'Settled') {
            throw Error(`Cannot create payment for status ${mollieMetadata.status} for order ${order.code}. Only Authorized or Settled are allowed.`);
        }
        core_1.Logger.info(`Payment for order ${order.code} with amount ${mollieMetadata.amount} created with state '${mollieMetadata.status}'`, constants_1.loggerCtx);
        return {
            amount: mollieMetadata.amount,
            state: mollieMetadata.status,
            transactionId: mollieMetadata.paymentId,
            metadata: mollieMetadata, // Store all given metadata on a payment
        };
    },
    settlePayment: async (ctx, order, payment, args) => {
        // Called for Authorized payments
        const { apiKey } = args;
        const mollieClient = (0, api_client_1.default)({ apiKey });
        const molliePayment = await mollieClient.payments.get(payment.transactionId);
        if (molliePayment.status === api_client_1.PaymentStatus.paid) {
            core_1.Logger.info(`Payment '${payment.id}' for ${order.code} is already captured`, constants_1.loggerCtx);
            return { success: true };
        }
        // We poll 10 x 500ms to see if the payment is captured, because it is done async, but usually fast enough to wait
        let capture = await mollieClient.paymentCaptures.create({
            paymentId: molliePayment.id,
            amount: molliePayment.amount,
        });
        for (let i = 0; i < 10; i++) {
            capture = await mollieClient.paymentCaptures.get(capture.id, { paymentId: molliePayment.id });
            if (capture.status === 'succeeded') {
                core_1.Logger.info(`Payment '${payment.id}' for ${order.code} is captured.`, constants_1.loggerCtx);
                return { success: true };
            }
            if (capture.status === 'failed') {
                throw new Error(`Failed to capture payment '${payment.id}' for ${order.code}. Please check your Mollie dashboard for payment '${molliePayment.id}' for more details.`);
            }
            // Wait 500ms before next attempt
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        throw new Error(`Failed to capture payment after 10 attempts. Last status: '${capture.status}'. Try again later`);
    },
    createRefund: async (ctx, input, amount, order, payment, args) => {
        const { apiKey } = args;
        const mollieClient = (0, api_client_1.default)({ apiKey });
        const molliePayment = await mollieClient.payments.get(payment.transactionId);
        if (!molliePayment) {
            throw Error(`No payment with status 'paid' was found in Mollie for order ${order.code} (Mollie payment ${payment.transactionId})`);
        }
        const refund = await mollieClient.paymentRefunds.create({
            paymentId: molliePayment.id,
            description: input.reason,
            amount: (0, mollie_helpers_1.toAmount)(amount, order.currencyCode),
        });
        if (refund.status === api_client_1.RefundStatus.failed) {
            core_1.Logger.error(`Failed to create refund of ${amount.toFixed()} for order ${order.code} for transaction ${molliePayment.id}`, constants_1.loggerCtx);
            return {
                state: 'Failed',
                transactionId: payment.transactionId,
            };
        }
        core_1.Logger.info(`Created refund of ${amount.toFixed()} for order ${order.code} for transaction ${payment.transactionId}`, constants_1.loggerCtx);
        return {
            state: 'Settled',
            transactionId: payment.transactionId,
        };
    },
});
//# sourceMappingURL=mollie.handler.js.map