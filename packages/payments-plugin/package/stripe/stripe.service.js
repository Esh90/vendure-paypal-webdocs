"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const constants_1 = require("./constants");
const metadata_sanitize_1 = require("./metadata-sanitize");
const stripe_client_1 = require("./stripe-client");
const stripe_utils_1 = require("./stripe-utils");
const stripe_handler_1 = require("./stripe.handler");
let StripeService = class StripeService {
    constructor(options, connection, paymentMethodService, moduleRef) {
        this.options = options;
        this.connection = connection;
        this.paymentMethodService = paymentMethodService;
        this.moduleRef = moduleRef;
    }
    async createPaymentIntent(ctx, order) {
        var _a, _b, _c, _d, _e;
        let customerId;
        const stripe = await this.getStripeClient(ctx, order);
        if (this.options.storeCustomersInStripe && ctx.activeUserId) {
            customerId = await this.getStripeCustomerId(ctx, order);
        }
        const amountInMinorUnits = (0, stripe_utils_1.getAmountInStripeMinorUnits)(order);
        const additionalParams = await ((_b = (_a = this.options).paymentIntentCreateParams) === null || _b === void 0 ? void 0 : _b.call(_a, new core_2.Injector(this.moduleRef), ctx, order));
        const additionalOptions = await ((_d = (_c = this.options).requestOptions) === null || _d === void 0 ? void 0 : _d.call(_c, new core_2.Injector(this.moduleRef), ctx, order));
        const metadata = (0, metadata_sanitize_1.sanitizeMetadata)(Object.assign(Object.assign({}, (typeof this.options.metadata === 'function'
            ? await this.options.metadata(new core_2.Injector(this.moduleRef), ctx, order)
            : {})), { channelToken: ctx.channel.token, orderId: order.id, orderCode: order.code, languageCode: ctx.languageCode }));
        const allMetadata = Object.assign(Object.assign({}, metadata), (0, metadata_sanitize_1.sanitizeMetadata)((_e = additionalParams === null || additionalParams === void 0 ? void 0 : additionalParams.metadata) !== null && _e !== void 0 ? _e : {}));
        const { client_secret } = await stripe.paymentIntents.create(Object.assign(Object.assign({ amount: amountInMinorUnits, currency: order.currencyCode.toLowerCase(), customer: customerId, automatic_payment_methods: {
                enabled: true,
            } }, (additionalParams !== null && additionalParams !== void 0 ? additionalParams : {})), { metadata: allMetadata }), Object.assign({ idempotencyKey: `${order.code}_${amountInMinorUnits}` }, (additionalOptions !== null && additionalOptions !== void 0 ? additionalOptions : {})));
        if (!client_secret) {
            // This should never happen
            core_2.Logger.warn(`Payment intent creation for order ${order.code} did not return client secret`, constants_1.loggerCtx);
            throw Error('Failed to create payment intent');
        }
        return client_secret !== null && client_secret !== void 0 ? client_secret : undefined;
    }
    async constructEventFromPayload(ctx, order, payload, signature) {
        const stripe = await this.getStripeClient(ctx, order);
        return stripe.webhooks.constructEvent(payload, signature, stripe.webhookSecret);
    }
    async createRefund(ctx, order, payment, amount) {
        const stripe = await this.getStripeClient(ctx, order);
        return stripe.refunds.create({
            payment_intent: payment.transactionId,
            amount,
        });
    }
    /**
     * Get Stripe client based on eligible payment methods for order
     */
    async getStripeClient(ctx, order) {
        const [eligiblePaymentMethods, paymentMethods] = await Promise.all([
            this.paymentMethodService.getEligiblePaymentMethods(ctx, order),
            this.paymentMethodService.findAll(ctx, {
                filter: {
                    enabled: { eq: true },
                },
            }),
        ]);
        const stripePaymentMethod = paymentMethods.items.find(pm => pm.handler.code === stripe_handler_1.stripePaymentMethodHandler.code);
        if (!stripePaymentMethod) {
            throw new core_2.UserInputError('No enabled Stripe payment method found');
        }
        const isEligible = eligiblePaymentMethods.some(pm => pm.code === stripePaymentMethod.code);
        if (!isEligible) {
            throw new core_2.UserInputError(`Stripe payment method is not eligible for order ${order.code}`);
        }
        const apiKey = this.findOrThrowArgValue(stripePaymentMethod.handler.args, 'apiKey');
        const webhookSecret = this.findOrThrowArgValue(stripePaymentMethod.handler.args, 'webhookSecret');
        return new stripe_client_1.VendureStripeClient(apiKey, webhookSecret);
    }
    findOrThrowArgValue(args, name) {
        var _a;
        const value = (_a = args.find(arg => arg.name === name)) === null || _a === void 0 ? void 0 : _a.value;
        if (!value) {
            throw Error(`No argument named '${name}' found!`);
        }
        return value;
    }
    /**
     * Returns the stripeCustomerId if the Customer has one. If that's not the case, queries Stripe to check
     * if the customer is already registered, in which case it saves the id as stripeCustomerId and returns it.
     * Otherwise, creates a new Customer record in Stripe and returns the generated id.
     */
    async getStripeCustomerId(ctx, activeOrder) {
        var _a, _b;
        const [stripe, order] = await Promise.all([
            this.getStripeClient(ctx, activeOrder),
            // Load relation with customer not available in the response from activeOrderService.getOrderFromContext()
            this.connection.getRepository(ctx, core_2.Order).findOne({
                where: { id: activeOrder.id },
                relations: ['customer'],
            }),
        ]);
        if (!order || !order.customer) {
            // This should never happen
            return undefined;
        }
        const { customer } = order;
        if (customer.customFields.stripeCustomerId) {
            return customer.customFields.stripeCustomerId;
        }
        let stripeCustomerId;
        const stripeCustomers = await stripe.customers.list({ email: customer.emailAddress });
        if (stripeCustomers.data.length > 0) {
            stripeCustomerId = stripeCustomers.data[0].id;
        }
        else {
            const additionalParams = await ((_b = (_a = this.options).customerCreateParams) === null || _b === void 0 ? void 0 : _b.call(_a, new core_2.Injector(this.moduleRef), ctx, order));
            const newStripeCustomer = await stripe.customers.create(Object.assign(Object.assign({ email: customer.emailAddress, name: `${customer.firstName} ${customer.lastName}` }, (additionalParams !== null && additionalParams !== void 0 ? additionalParams : {})), ((additionalParams === null || additionalParams === void 0 ? void 0 : additionalParams.metadata)
                ? { metadata: (0, metadata_sanitize_1.sanitizeMetadata)(additionalParams.metadata) }
                : {})));
            stripeCustomerId = newStripeCustomer.id;
            core_2.Logger.info(`Created Stripe Customer record for customerId ${customer.id}`, constants_1.loggerCtx);
        }
        customer.customFields.stripeCustomerId = stripeCustomerId;
        await this.connection.getRepository(ctx, core_2.Customer).save(customer, { reload: false });
        return stripeCustomerId;
    }
};
exports.StripeService = StripeService;
exports.StripeService = StripeService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(constants_1.STRIPE_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_2.TransactionalConnection,
        core_2.PaymentMethodService,
        core_1.ModuleRef])
], StripeService);
//# sourceMappingURL=stripe.service.js.map