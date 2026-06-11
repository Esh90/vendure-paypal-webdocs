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
exports.StripeResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const stripe_service_1 = require("./stripe.service");
let StripeResolver = class StripeResolver {
    constructor(stripeService, activeOrderService) {
        this.stripeService = stripeService;
        this.activeOrderService = activeOrderService;
    }
    async createStripePaymentIntent(ctx) {
        if (!ctx.authorizedAsOwnerOnly) {
            throw new core_1.UnauthorizedError();
        }
        const sessionOrder = await this.activeOrderService.getActiveOrder(ctx, undefined);
        if (!sessionOrder) {
            throw new core_1.UserInputError('No active order found for session');
        }
        return this.stripeService.createPaymentIntent(ctx, sessionOrder);
    }
};
exports.StripeResolver = StripeResolver;
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Owner),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], StripeResolver.prototype, "createStripePaymentIntent", null);
exports.StripeResolver = StripeResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [stripe_service_1.StripeService, core_1.ActiveOrderService])
], StripeResolver);
//# sourceMappingURL=stripe.resolver.js.map