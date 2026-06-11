import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { PayPalSubscriptionService } from '../paypal-subscription.service';
import { CreateSubscriptionInput, SubscriptionResult } from '../subscription-types';

@Resolver()
export class PayPalSubscriptionShopResolver {
    constructor(private readonly subscriptionService: PayPalSubscriptionService) {}

    @Mutation()
    @Allow(Permission.Public)
    createPayPalSubscription(
        @Ctx() ctx: RequestContext,
        @Args('input') input: CreateSubscriptionInput,
    ): Promise<SubscriptionResult> {
        return this.subscriptionService.createSubscription(ctx, input);
    }
}
