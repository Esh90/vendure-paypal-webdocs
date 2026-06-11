"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.braintreePaymentMethodHandler = void 0;
const generated_types_1 = require("@vendure/common/lib/generated-types");
const core_1 = require("@vendure/core");
const braintree_common_1 = require("./braintree-common");
const constants_1 = require("./constants");
let options;
let connection;
let entityHydrator;
/**
 * The handler for Braintree payments.
 */
exports.braintreePaymentMethodHandler = new core_1.PaymentMethodHandler({
    code: 'braintree',
    description: [{ languageCode: generated_types_1.LanguageCode.en, value: 'Braintree payments' }],
    args: {
        merchantId: { type: 'string', label: [{ languageCode: generated_types_1.LanguageCode.en, value: 'Merchant ID' }] },
        publicKey: { type: 'string', label: [{ languageCode: generated_types_1.LanguageCode.en, value: 'Public Key' }] },
        privateKey: { type: 'string', label: [{ languageCode: generated_types_1.LanguageCode.en, value: 'Private Key' }] },
    },
    init(injector) {
        options = injector.get(constants_1.BRAINTREE_PLUGIN_OPTIONS);
        connection = injector.get(core_1.TransactionalConnection);
        entityHydrator = injector.get(core_1.EntityHydrator);
    },
    async createPayment(ctx, order, amount, args, metadata) {
        const gateway = (0, braintree_common_1.getGateway)(args, options);
        let customerId;
        try {
            await entityHydrator.hydrate(ctx, order, { relations: ['customer'] });
            const customer = order.customer;
            if (options.storeCustomersInBraintree &&
                ctx.activeUserId &&
                customer &&
                metadata.includeCustomerId !== false) {
                customerId = await getBraintreeCustomerId(ctx, gateway, customer);
            }
            return processPayment(ctx, gateway, order, amount, metadata.nonce, customerId, options);
        }
        catch (e) {
            core_1.Logger.error(e, constants_1.loggerCtx);
            return {
                amount,
                state: 'Error',
                transactionId: '',
                errorMessage: e.toString(),
                metadata: e,
            };
        }
    },
    settlePayment() {
        return {
            success: true,
        };
    },
    async createRefund(ctx, input, total, order, payment, args) {
        var _a;
        const gateway = (0, braintree_common_1.getGateway)(args, options);
        const response = await gateway.transaction.refund(payment.transactionId, (total / 100).toString(10));
        if (!response.success) {
            return {
                state: 'Failed',
                transactionId: (_a = response.transaction) === null || _a === void 0 ? void 0 : _a.id,
                metadata: response,
            };
        }
        return {
            state: 'Settled',
            transactionId: response.transaction.id,
            metadata: response,
        };
    },
});
async function processPayment(ctx, gateway, order, amount, paymentMethodNonce, customerId, pluginOptions) {
    var _a, _b;
    const response = await gateway.transaction.sale({
        customerId,
        amount: (amount / 100).toString(10),
        orderId: order.code,
        paymentMethodNonce,
        options: {
            submitForSettlement: true,
            storeInVaultOnSuccess: !!customerId,
        },
    });
    const extractMetadataFn = (_a = pluginOptions.extractMetadata) !== null && _a !== void 0 ? _a : braintree_common_1.defaultExtractMetadataFn;
    const metadata = response.transaction && extractMetadataFn(response.transaction);
    if (!response.success) {
        return {
            amount,
            state: 'Declined',
            transactionId: (_b = response.transaction) === null || _b === void 0 ? void 0 : _b.id,
            errorMessage: response.message,
            metadata,
        };
    }
    return {
        amount,
        state: 'Settled',
        transactionId: response.transaction.id,
        metadata,
    };
}
/**
 * If the Customer has no braintreeCustomerId, create one, else return the existing braintreeCustomerId.
 */
async function getBraintreeCustomerId(ctx, gateway, customer) {
    if (!customer.customFields.braintreeCustomerId) {
        try {
            const result = await gateway.customer.create({
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: customer.emailAddress,
            });
            if (result.success) {
                const customerId = result.customer.id;
                core_1.Logger.verbose(`Created Braintree Customer record for customerId ${customer.id}`, constants_1.loggerCtx);
                customer.customFields.braintreeCustomerId = customerId;
                await connection.getRepository(ctx, core_1.Customer).save(customer, { reload: false });
                return customerId;
            }
            else {
                core_1.Logger.error(`Failed to create Braintree Customer record for customerId ${customer.id}. View Debug level logs for details.`, constants_1.loggerCtx);
                core_1.Logger.debug(JSON.stringify(result.errors, null, 2), constants_1.loggerCtx);
            }
        }
        catch (e) {
            core_1.Logger.error(e.message, constants_1.loggerCtx, e.stack);
        }
    }
    else {
        return customer.customFields.braintreeCustomerId;
    }
}
//# sourceMappingURL=braintree.handler.js.map