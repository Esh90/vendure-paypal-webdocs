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
exports.BraintreeResolver = void 0;
const common_1 = require("@nestjs/common");
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const braintree_common_1 = require("./braintree-common");
const braintree_handler_1 = require("./braintree.handler");
const constants_1 = require("./constants");
let BraintreeResolver = class BraintreeResolver {
    constructor(connection, orderService, activeOrderService, options) {
        this.connection = connection;
        this.orderService = orderService;
        this.activeOrderService = activeOrderService;
        this.options = options;
    }
    async generateBraintreeClientToken(ctx, { orderId, includeCustomerId }) {
        var _a, _b, _c;
        if (orderId) {
            core_1.Logger.warn('The orderId argument to the generateBraintreeClientToken mutation has been deprecated and may be omitted.');
        }
        const sessionOrder = await this.activeOrderService.getOrderFromContext(ctx);
        if (!sessionOrder) {
            throw new core_1.InternalServerError('Cannot generate Braintree clientToken as there is no active Order.');
        }
        const order = await this.orderService.findOne(ctx, sessionOrder.id);
        if (order) {
            const customerId = (_b = (_a = order.customer) === null || _a === void 0 ? void 0 : _a.customFields.braintreeCustomerId) !== null && _b !== void 0 ? _b : undefined;
            const args = await this.getPaymentMethodArgs(ctx);
            const gateway = (0, braintree_common_1.getGateway)(args, this.options);
            try {
                let result = await gateway.clientToken.generate({
                    customerId: includeCustomerId === false ? undefined : customerId,
                });
                if (result.success === true) {
                    return result.clientToken;
                }
                else {
                    if (result.message === 'Customer specified by customer_id does not exist') {
                        // For some reason the custom_id is invalid. This could occur e.g. if the ID was created on the Sandbox endpoint and now
                        // we switched to Production. In this case, we will remove it and allow a new one
                        // to be generated when the payment is created.
                        if (this.options.storeCustomersInBraintree) {
                            if ((_c = order.customer) === null || _c === void 0 ? void 0 : _c.customFields.braintreeCustomerId) {
                                order.customer.customFields.braintreeCustomerId = undefined;
                                await this.connection.getRepository(ctx, core_1.Customer).save(order.customer);
                            }
                        }
                        result = await gateway.clientToken.generate({ customerId: undefined });
                        if (result.success === true) {
                            return result.clientToken;
                        }
                    }
                    core_1.Logger.error(`Could not generate Braintree clientToken: ${result.message}`, constants_1.loggerCtx);
                    throw new core_1.InternalServerError(`Could not generate Braintree clientToken: ${result.message}`);
                }
            }
            catch (e) {
                core_1.Logger.error('Could not generate Braintree clientToken. Check the configured credentials.', constants_1.loggerCtx);
                throw e;
            }
        }
        else {
            throw new core_1.InternalServerError(`[${constants_1.loggerCtx}] Could not find a Customer for the given Order`);
        }
    }
    async getPaymentMethodArgs(ctx) {
        const method = (await this.connection.getRepository(ctx, core_1.PaymentMethod).find()).find(m => m.handler.code === braintree_handler_1.braintreePaymentMethodHandler.code);
        if (!method) {
            throw new core_1.InternalServerError(`[${constants_1.loggerCtx}] Could not find Braintree PaymentMethod`);
        }
        return method.handler.args.reduce((hash, arg) => {
            return Object.assign(Object.assign({}, hash), { [arg.name]: arg.value });
        }, {});
    }
};
exports.BraintreeResolver = BraintreeResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], BraintreeResolver.prototype, "generateBraintreeClientToken", null);
exports.BraintreeResolver = BraintreeResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __param(3, (0, common_1.Inject)(constants_1.BRAINTREE_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.OrderService,
        core_1.ActiveOrderService, Object])
], BraintreeResolver);
//# sourceMappingURL=braintree.resolver.js.map