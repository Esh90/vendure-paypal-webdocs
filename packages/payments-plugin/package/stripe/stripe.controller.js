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
exports.StripeController = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const generated_graphql_shop_errors_1 = require("@vendure/core/dist/common/error/generated-graphql-shop-errors");
const constants_1 = require("./constants");
const stripe_utils_1 = require("./stripe-utils");
const stripe_handler_1 = require("./stripe.handler");
const stripe_service_1 = require("./stripe.service");
const missingHeaderErrorMessage = 'Missing stripe-signature header';
const signatureErrorMessage = 'Error verifying Stripe webhook signature';
const noPaymentIntentErrorMessage = 'No payment intent in the event payload';
const ignorePaymentIntentEvent = 'Event has no Vendure metadata, skipped.';
let StripeController = class StripeController {
    constructor(options, paymentMethodService, orderService, stripeService, requestContextService, connection, channelService) {
        this.options = options;
        this.paymentMethodService = paymentMethodService;
        this.orderService = orderService;
        this.stripeService = stripeService;
        this.requestContextService = requestContextService;
        this.connection = connection;
        this.channelService = channelService;
    }
    async webhook(signature, request, response) {
        if (!signature) {
            core_1.Logger.error(missingHeaderErrorMessage, constants_1.loggerCtx);
            response.status(common_1.HttpStatus.BAD_REQUEST).send(missingHeaderErrorMessage);
            return;
        }
        const event = JSON.parse(request.body.toString());
        const paymentIntent = event.data.object;
        if (!paymentIntent) {
            core_1.Logger.error(noPaymentIntentErrorMessage, constants_1.loggerCtx);
            response.status(common_1.HttpStatus.BAD_REQUEST).send(noPaymentIntentErrorMessage);
            return;
        }
        const { metadata } = paymentIntent;
        if (!(0, stripe_utils_1.isExpectedVendureStripeEventMetadata)(metadata)) {
            if (this.options.skipPaymentIntentsWithoutExpectedMetadata) {
                response.status(common_1.HttpStatus.OK).send(ignorePaymentIntentEvent);
                return;
            }
            throw new Error(`Missing expected payment intent metadata, unable to settle payment ${paymentIntent.id}!`);
        }
        const { channelToken, orderCode, orderId, languageCode } = metadata;
        const outerCtx = await this.createContext(channelToken, languageCode, request);
        await this.connection.withTransaction(outerCtx, async (ctx) => {
            var _a, _b;
            const order = await this.orderService.findOneByCode(ctx, orderCode);
            if (!order) {
                throw new Error(`Unable to find order ${orderCode}, unable to settle payment ${paymentIntent.id}!`);
            }
            try {
                // Throws an error if the signature is invalid
                await this.stripeService.constructEventFromPayload(ctx, order, request.rawBody, signature);
            }
            catch (e) {
                core_1.Logger.error(`${signatureErrorMessage} ${signature}: ${e === null || e === void 0 ? void 0 : e.message}`, constants_1.loggerCtx);
                response.status(common_1.HttpStatus.BAD_REQUEST).send(signatureErrorMessage);
                return;
            }
            if (event.type === 'payment_intent.payment_failed') {
                const message = (_b = (_a = paymentIntent.last_payment_error) === null || _a === void 0 ? void 0 : _a.message) !== null && _b !== void 0 ? _b : 'unknown error';
                core_1.Logger.warn(`Payment for order ${orderCode} failed: ${message}`, constants_1.loggerCtx);
                response.status(common_1.HttpStatus.OK).send('Ok');
                return;
            }
            if (event.type !== 'payment_intent.succeeded') {
                // This should never happen as the webhook is configured to receive
                // payment_intent.succeeded and payment_intent.payment_failed events only
                core_1.Logger.info(`Received ${event.type} status update for order ${orderCode}`, constants_1.loggerCtx);
                return;
            }
            if (order.state !== 'ArrangingPayment' && order.state !== 'ArrangingAdditionalPayment') {
                // The stripe plugin based on https://github.com/vendure-ecommerce/vendure/pull/3624 can export the
                // StripeService to support additional payment flows where state can be ArrangingAdditionalPayment.
                // Orders can switch channels (e.g., global to UK store), causing lookups by the original
                // channel to fail. Using a default channel avoids "entity-with-id-not-found" errors.
                // See https://github.com/vendure-ecommerce/vendure/issues/3072
                // First use the channel specific context to transition the order state, which is the default behavior
                // prior to issue: https://github.com/vendure-ecommerce/vendure/issues/3072
                let transitionToStateResult = await this.orderService.transitionToState(ctx, orderId, 'ArrangingPayment');
                // If the channel specific context fails, try to use the default channel context
                // to transition the order state. Issue: https://github.com/vendure-ecommerce/vendure/issues/3072
                if (transitionToStateResult instanceof generated_graphql_shop_errors_1.OrderStateTransitionError) {
                    const defaultChannel = await this.channelService.getDefaultChannel(ctx);
                    const ctxWithDefaultChannel = await this.createContext(defaultChannel.token, languageCode, request);
                    transitionToStateResult = await this.orderService.transitionToState(ctxWithDefaultChannel, orderId, 'ArrangingPayment');
                }
                // If the order is still not in the ArrangingPayment state, log an error
                if (transitionToStateResult instanceof generated_graphql_shop_errors_1.OrderStateTransitionError) {
                    core_1.Logger.error(`Error transitioning order ${orderCode} to ArrangingPayment state: ${transitionToStateResult.message}`, constants_1.loggerCtx);
                    return;
                }
            }
            const paymentMethod = await this.getPaymentMethod(ctx);
            const addPaymentToOrderResult = await this.orderService.addPaymentToOrder(ctx, orderId, {
                method: paymentMethod.code,
                metadata: {
                    paymentIntentAmountReceived: paymentIntent.amount_received,
                    paymentIntentId: paymentIntent.id,
                },
            });
            if (!(addPaymentToOrderResult instanceof core_1.Order)) {
                core_1.Logger.error(`Error adding payment to order ${orderCode}: ${addPaymentToOrderResult.message}`, constants_1.loggerCtx);
                return;
            }
            // The payment intent ID is added to the order only if we can reach this point.
            core_1.Logger.info(`Stripe payment intent id ${paymentIntent.id} added to order ${orderCode}`, constants_1.loggerCtx);
        });
        // Send the response status only if we didn't sent anything yet.
        if (!response.headersSent) {
            response.status(common_1.HttpStatus.OK).send('Ok');
        }
    }
    async createContext(channelToken, languageCode, req) {
        return this.requestContextService.create({
            apiType: 'admin',
            channelOrToken: channelToken,
            // This is a workaround for a type mismatch between express v5 (Vendure core)
            // and express v4 (several transitive dependencies). Can be removed once the
            // ecosystem has more significantly shifted to v5.
            req: req,
            languageCode,
        });
    }
    async getPaymentMethod(ctx) {
        const method = (await this.paymentMethodService.findAll(ctx)).items.find(m => m.handler.code === stripe_handler_1.stripePaymentMethodHandler.code);
        if (!method) {
            throw new core_1.InternalServerError(`[${constants_1.loggerCtx}] Could not find Stripe PaymentMethod`);
        }
        return method;
    }
};
exports.StripeController = StripeController;
__decorate([
    (0, common_1.Post)('stripe'),
    __param(0, (0, common_1.Headers)('stripe-signature')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], StripeController.prototype, "webhook", null);
exports.StripeController = StripeController = __decorate([
    (0, common_1.Controller)('payments'),
    __param(0, (0, common_1.Inject)(constants_1.STRIPE_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_1.PaymentMethodService,
        core_1.OrderService,
        stripe_service_1.StripeService,
        core_1.RequestContextService,
        core_1.TransactionalConnection,
        core_1.ChannelService])
], StripeController);
//# sourceMappingURL=stripe.controller.js.map