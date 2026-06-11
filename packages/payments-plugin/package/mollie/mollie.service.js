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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MollieService = void 0;
const api_client_1 = __importStar(require("@mollie/api-client"));
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const core_3 = require("@vendure/core/");
const order_utils_1 = require("@vendure/core/dist/service/helpers/utils/order-utils");
const constants_1 = require("./constants");
const generated_shop_types_1 = require("./graphql/generated-shop-types");
const mollie_handler_1 = require("./mollie.handler");
const mollie_helpers_1 = require("./mollie.helpers");
class PaymentIntentError {
    constructor(message) {
        this.message = message;
        this.errorCode = generated_shop_types_1.ErrorCode.ORDER_PAYMENT_STATE_ERROR;
    }
}
class InvalidInputError {
    constructor(message) {
        this.message = message;
        this.errorCode = generated_shop_types_1.ErrorCode.INELIGIBLE_PAYMENT_METHOD_ERROR;
    }
}
let MollieService = class MollieService {
    constructor(paymentMethodService, options, activeOrderService, orderService, entityHydrator, moduleRef) {
        this.paymentMethodService = paymentMethodService;
        this.options = options;
        this.activeOrderService = activeOrderService;
        this.orderService = orderService;
        this.entityHydrator = entityHydrator;
        this.moduleRef = moduleRef;
        this.injector = new core_2.Injector(this.moduleRef);
    }
    /**
     * Creates a redirectUrl to Mollie for the given paymentMethod and current activeOrder
     */
    async createPaymentIntent(ctx, input) {
        var _a, _b, _c, _d;
        const { paymentMethodCode, molliePaymentMethodCode } = input;
        const [order, paymentMethod] = await Promise.all([
            this.getOrder(ctx, input.orderId),
            this.getPaymentMethod(ctx, paymentMethodCode),
        ]);
        if (order instanceof PaymentIntentError) {
            return order;
        }
        if (!paymentMethod) {
            return new PaymentIntentError(`No paymentMethod found with code ${String(paymentMethodCode)}`);
        }
        const eligiblePaymentMethods = await this.orderService.getEligiblePaymentMethods(ctx, order.id);
        if (!eligiblePaymentMethods.find(eligibleMethod => (0, core_2.idsAreEqual)(eligibleMethod.id, paymentMethod === null || paymentMethod === void 0 ? void 0 : paymentMethod.id) && eligibleMethod.isEligible)) {
            // Given payment method code is not eligible for this order
            return new InvalidInputError(`Payment method ${paymentMethod === null || paymentMethod === void 0 ? void 0 : paymentMethod.code} is not eligible for order ${order.code}`);
        }
        if (order.state !== 'ArrangingPayment' && order.state !== 'ArrangingAdditionalPayment') {
            // Pre-check if order is transitionable to ArrangingPayment, because that will happen after Mollie payment
            try {
                await this.canTransitionTo(ctx, order.id, 'ArrangingPayment');
            }
            catch (e) {
                if (e.message) {
                    return new PaymentIntentError(e.message);
                }
                throw e;
            }
        }
        if (!((_a = order.customer) === null || _a === void 0 ? void 0 : _a.firstName.length)) {
            return new PaymentIntentError('Cannot create payment intent for order with customer that has no firstName set');
        }
        if (!((_b = order.customer) === null || _b === void 0 ? void 0 : _b.lastName.length)) {
            return new PaymentIntentError('Cannot create payment intent for order with customer that has no lastName set');
        }
        let redirectUrl = input.redirectUrl;
        if (!redirectUrl) {
            // Use fallback redirect if no redirectUrl is given
            let fallbackRedirect = (_c = paymentMethod.handler.args.find(arg => arg.name === 'redirectUrl')) === null || _c === void 0 ? void 0 : _c.value;
            if (!fallbackRedirect) {
                return new PaymentIntentError('No redirect URl was given and no fallback redirect is configured');
            }
            redirectUrl = fallbackRedirect;
            // remove appending slash if present
            fallbackRedirect = fallbackRedirect.endsWith('/')
                ? fallbackRedirect.slice(0, -1)
                : fallbackRedirect;
            redirectUrl = `${fallbackRedirect}/${order.code}`;
        }
        const apiKey = (_d = paymentMethod.handler.args.find(arg => arg.name === 'apiKey')) === null || _d === void 0 ? void 0 : _d.value;
        if (!apiKey) {
            core_2.Logger.warn(`CreatePaymentIntent failed, because no apiKey is configured for ${paymentMethod.code}`, constants_1.loggerCtx);
            return new PaymentIntentError(`Paymentmethod ${paymentMethod.code} has no apiKey configured`);
        }
        const mollieClient = (0, api_client_1.default)({ apiKey });
        const vendureHost = this.options.vendureHost.endsWith('/')
            ? this.options.vendureHost.slice(0, -1)
            : this.options.vendureHost; // remove appending slash
        const billingAddress = (0, mollie_helpers_1.toMollieAddress)(order.billingAddress, order.customer) ||
            (0, mollie_helpers_1.toMollieAddress)(order.shippingAddress, order.customer);
        if (!billingAddress) {
            return new InvalidInputError("Order doesn't have a complete shipping address or billing address. " +
                'At least city, postalCode, streetline1 and country are needed to create a payment intent.');
        }
        const alreadyPaid = (0, order_utils_1.totalCoveredByPayments)(order);
        const amountToPay = order.totalWithTax - alreadyPaid;
        if (amountToPay === 0) {
            // The order can be transitioned to PaymentSettled, because the order has 0 left to pay
            // Only admins can add payments, so we need an admin ctx
            const adminCtx = new core_2.RequestContext({
                apiType: 'admin',
                isAuthorized: true,
                authorizedAsOwnerOnly: false,
                channel: ctx.channel,
                languageCode: ctx.languageCode,
                req: ctx.req,
            });
            await this.addPayment(adminCtx, order, amountToPay, {
                paymentId: 'Settled without Mollie',
                method: 'Settled without Mollie',
            }, paymentMethod.code, 'Settled');
            return {
                url: redirectUrl,
            };
        }
        const paymentInput = {
            description: order.code,
            amount: (0, mollie_helpers_1.toAmount)(amountToPay, order.currencyCode),
            redirectUrl,
            webhookUrl: `${vendureHost}/payments/mollie/${ctx.channel.token}/${paymentMethod.id}`,
            billingAddress,
            locale: input.locale,
            lines: (0, mollie_helpers_1.toMolliePaymentLines)(order, alreadyPaid),
            metadata: {
                languageCode: ctx.languageCode,
            },
            captureMode: input.immediateCapture === false ? api_client_1.CaptureMethod.manual : api_client_1.CaptureMethod.automatic,
        };
        if (molliePaymentMethodCode) {
            paymentInput.method = molliePaymentMethodCode;
        }
        const molliePayment = await mollieClient.payments.create(paymentInput);
        core_2.Logger.info(`Created Mollie payment ${String(molliePayment.id)} for order ${order.code}`, constants_1.loggerCtx);
        const url = molliePayment.getCheckoutUrl();
        if (!url) {
            throw Error('Unable to getCheckoutUrl() from Mollie payment');
        }
        return {
            url,
        };
    }
    /**
     * Update Vendure payments and order status based on the incoming Mollie payment
     */
    async handleMollieStatusUpdate(ctx, { paymentMethodId, paymentId }) {
        var _a, _b;
        core_2.Logger.info(`Received status update for channel ${ctx.channel.token} for Mollie payment ${paymentId}`, constants_1.loggerCtx);
        const paymentMethod = await this.paymentMethodService.findOne(ctx, paymentMethodId);
        if (!paymentMethod) {
            // Fail silently, as we don't want to expose if a paymentMethodId exists or not
            return core_2.Logger.warn(`No paymentMethod found with id ${paymentMethodId}`, constants_1.loggerCtx);
        }
        const apiKey = (_a = paymentMethod.handler.args.find(a => a.name === 'apiKey')) === null || _a === void 0 ? void 0 : _a.value;
        if (!apiKey) {
            throw Error(`No apiKey found for payment ${paymentMethod.id} for channel ${ctx.channel.token}`);
        }
        const client = (0, api_client_1.default)({ apiKey });
        const molliePayment = await client.payments.get(paymentId);
        const metadataLanguageCode = (_b = molliePayment.metadata) === null || _b === void 0 ? void 0 : _b.languageCode;
        if (metadataLanguageCode) {
            // Recreate ctx with the original languageCode
            ctx = new core_2.RequestContext({
                apiType: 'admin',
                isAuthorized: true,
                authorizedAsOwnerOnly: false,
                req: ctx.req,
                channel: ctx.channel,
                languageCode: metadataLanguageCode,
            });
        }
        core_2.Logger.info(`Processing incoming webhook status '${molliePayment.status}' for order ${molliePayment.description} for channel ${ctx.channel.token} for Mollie payment ${paymentId}`, constants_1.loggerCtx);
        let order = await this.orderService.findOneByCode(ctx, molliePayment.description, ['payments']);
        if (!order) {
            throw Error(`Unable to find order ${molliePayment.description}, unable to process Mollie payment ${molliePayment.id}`);
        }
        const mollieStatesThatRequireAction = [api_client_1.PaymentStatus.authorized, api_client_1.PaymentStatus.paid];
        if (!mollieStatesThatRequireAction.includes(molliePayment.status)) {
            // No need to handle this mollie webhook status
            core_2.Logger.info(`Ignoring Mollie status '${molliePayment.status}' from incoming webhook for '${order.code}'`, constants_1.loggerCtx);
            return;
        }
        if (order.orderPlacedAt) {
            const paymentWithSameTransactionId = order.payments.find(p => p.transactionId === molliePayment.id);
            if (!paymentWithSameTransactionId) {
                // The order is paid for again, with another transaction ID. This means the customer paid twice
                core_2.Logger.error(`Order '${order.code}' is already paid. Mollie payment '${molliePayment.id}' should be refunded.`, constants_1.loggerCtx);
                return;
            }
        }
        if (order.state === 'Cancelled' && molliePayment.status === api_client_1.PaymentStatus.paid) {
            core_2.Logger.error(`Order '${order.code}' is 'Cancelled'', but was paid for with '${molliePayment.id}'. Payment '${molliePayment.id}' should be refunded.`, constants_1.loggerCtx);
            return;
        }
        // If order is not in one of these states, we don't need to handle the Mollie webhook
        const vendureStatesThatRequireAction = [
            'AddingItems',
            'ArrangingPayment',
            'ArrangingAdditionalPayment',
            'PaymentAuthorized',
            'Draft',
        ];
        if (!vendureStatesThatRequireAction.includes(order.state)) {
            core_2.Logger.info(`Order ${order.code} is already '${order.state}', no need for handling Mollie status '${molliePayment.status}'`, constants_1.loggerCtx);
            return;
        }
        const amount = (0, mollie_helpers_1.amountToCents)(molliePayment.amount);
        // Metadata to add to a payment
        const mollieMetadata = {
            paymentId: molliePayment.id,
            method: molliePayment.method,
            mode: molliePayment.mode,
            profileId: molliePayment.profileId,
            authorizedAt: molliePayment.authorizedAt,
            paidAt: molliePayment.paidAt,
        };
        if (order.state === 'PaymentAuthorized' && molliePayment.status === api_client_1.PaymentStatus.paid) {
            // If our order is in PaymentAuthorized state, it means a 2 step payment was used (E.g. a pay-later method like Klarna)
            return this.settleExistingPayment(ctx, order, molliePayment.id);
        }
        if (molliePayment.status === api_client_1.PaymentStatus.paid) {
            await this.addPayment(ctx, order, amount, mollieMetadata, paymentMethod.code, 'Settled');
            return;
        }
        if (order.state === 'AddingItems' && molliePayment.status === api_client_1.PaymentStatus.authorized) {
            // Transition order to PaymentAuthorized by creating an authorized payment
            order = await this.addPayment(ctx, order, amount, mollieMetadata, paymentMethod.code, 'Authorized');
            return;
        }
        // Any other combination of Mollie status and Vendure status indicates something is wrong.
        throw Error(`Unhandled incoming Mollie status '${molliePayment.status}' for order ${order.code} with status '${order.state}'`);
    }
    /**
     * Add payment to order. Can be settled or authorized depending on the payment method.
     */
    async addPayment(ctx, order, amount, mollieMetadata, paymentMethodCode, status) {
        if (order.state !== 'ArrangingPayment' && order.state !== 'ArrangingAdditionalPayment') {
            const transitionToStateResult = await this.orderService.transitionToState(ctx, order.id, 'ArrangingPayment');
            if (transitionToStateResult instanceof core_2.OrderStateTransitionError) {
                throw Error(`Error transitioning order ${order.code} from ${transitionToStateResult.fromState} ` +
                    `to ${transitionToStateResult.toState}: ${transitionToStateResult.message}`);
            }
        }
        const metadata = {
            amount,
            status,
            paymentId: mollieMetadata.paymentId,
            mode: mollieMetadata.mode,
            method: mollieMetadata.method,
            profileId: mollieMetadata.profileId,
            authorizedAt: mollieMetadata.authorizedAt,
            paidAt: mollieMetadata.paidAt,
        };
        const addPaymentToOrderResult = await this.orderService.addPaymentToOrder(ctx, order.id, {
            method: paymentMethodCode,
            metadata,
        });
        if (!(addPaymentToOrderResult instanceof core_2.Order)) {
            throw Error(`Error adding payment to order ${order.code}: ${addPaymentToOrderResult.message}`);
        }
        return addPaymentToOrderResult;
    }
    /**
     * Settle an existing payment based on the given Mollie payment ID
     */
    async settleExistingPayment(ctx, order, molliePaymentId) {
        order = await this.entityHydrator.hydrate(ctx, order, { relations: ['payments'] });
        const payment = order.payments.find(p => p.transactionId === molliePaymentId);
        if (!payment) {
            throw Error(`Cannot find payment ${molliePaymentId} for ${order.code}. Unable to settle this payment`);
        }
        const result = await this.orderService.settlePayment(ctx, payment.id);
        if (result.message) {
            throw Error(`Error settling payment ${payment.id} for order ${order.code}: ${result.errorCode} - ${result.message}`);
        }
    }
    async getEnabledPaymentMethods(ctx, paymentMethodCode) {
        var _a, _b, _c;
        const paymentMethod = await this.getPaymentMethod(ctx, paymentMethodCode);
        const apiKey = (_a = paymentMethod === null || paymentMethod === void 0 ? void 0 : paymentMethod.handler.args.find(arg => arg.name === 'apiKey')) === null || _a === void 0 ? void 0 : _a.value;
        if (!apiKey) {
            throw Error(`No apiKey configured for payment method ${paymentMethodCode}`);
        }
        const client = (0, api_client_1.default)({ apiKey });
        const activeOrder = await this.activeOrderService.getActiveOrder(ctx, undefined);
        const additionalParams = await ((_c = (_b = this.options).enabledPaymentMethodsParams) === null || _c === void 0 ? void 0 : _c.call(_b, this.injector, ctx, activeOrder !== null && activeOrder !== void 0 ? activeOrder : null));
        // We use the orders API, so list available methods for that API usage
        const methods = await client.methods.list(Object.assign(Object.assign({}, additionalParams), { resource: 'orders' }));
        return methods.map(m => (Object.assign(Object.assign({}, m), { code: m.id })));
    }
    /**
     * Dry run a transition to a given state.
     * As long as we don't call 'finalize', the transition never completes.
     */
    async canTransitionTo(ctx, orderId, state) {
        // Fetch new order object, because `transition()` mutates the order object
        const orderCopy = await (0, core_2.assertFound)(this.orderService.findOne(ctx, orderId));
        const orderStateMachine = this.injector.get(core_3.OrderStateMachine);
        await orderStateMachine.transition(ctx, orderCopy, state);
    }
    async getPaymentMethod(ctx, paymentMethodCode) {
        if (paymentMethodCode) {
            const { items } = await this.paymentMethodService.findAll(ctx, {
                filter: {
                    code: { eq: paymentMethodCode },
                },
            });
            return items.find(pm => pm.code === paymentMethodCode);
        }
        else {
            const { items } = await this.paymentMethodService.findAll(ctx);
            return items.find(pm => pm.handler.code === mollie_handler_1.molliePaymentHandler.code);
        }
    }
    /**
     * Get order by id, or active order if no orderId is given.
     *
     * Fetches order with all needed relations
     */
    async getOrder(ctx, orderId) {
        if (!orderId) {
            const order = await this.activeOrderService.getActiveOrder(ctx, undefined);
            if (!order) {
                return new PaymentIntentError('No active order found for session');
            }
            orderId = order.id;
        }
        return await (0, core_2.assertFound)(this.orderService.findOne(ctx, orderId, [
            'customer',
            'surcharges',
            'lines.productVariant',
            'lines.productVariant.translations',
            'shippingLines.shippingMethod',
            'payments',
        ]));
    }
};
exports.MollieService = MollieService;
exports.MollieService = MollieService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(constants_1.PLUGIN_INIT_OPTIONS)),
    __metadata("design:paramtypes", [core_2.PaymentMethodService, Object, core_2.ActiveOrderService,
        core_2.OrderService,
        core_2.EntityHydrator,
        core_1.ModuleRef])
], MollieService);
//# sourceMappingURL=mollie.service.js.map