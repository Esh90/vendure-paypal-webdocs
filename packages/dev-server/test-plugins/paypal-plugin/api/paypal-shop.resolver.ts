import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { PayPalCheckoutResult, PayPalService } from '../paypal.service';

@Resolver()
export class PayPalShopResolver {
    constructor(private readonly paypalService: PayPalService) {}

    @Mutation()
    @Allow(Permission.Public)
    async createPayPalCheckout(
        @Ctx() ctx: RequestContext,
        @Args('input')
        input?: {
            orderId?: ID;
            intent?: 'CAPTURE' | 'AUTHORIZE';
            returnUrl?: string;
            cancelUrl?: string;
        },
    ): Promise<PayPalCheckoutResult> {
        return this.paypalService.createCheckout(ctx, input ?? {});
    }
}
