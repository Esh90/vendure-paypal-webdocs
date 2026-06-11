import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { PayPalSubscription } from '../entities/paypal-subscription.entity';
import { PayPalSubscriptionService } from '../paypal-subscription.service';
import {
    BillingPlanResult,
    CreateBillingPlanInput,
} from '../subscription-types';

@Resolver()
export class PayPalSubscriptionAdminResolver {
    constructor(private readonly subscriptionService: PayPalSubscriptionService) {}

    @Query()
    @Allow(Permission.ReadPaymentMethod)
    payPalBillingPlans(
        @Ctx() ctx: RequestContext,
        @Args('productId') productId?: string,
    ): Promise<BillingPlanResult[]> {
        return this.subscriptionService.listBillingPlans(ctx, productId);
    }

    @Query()
    @Allow(Permission.ReadPaymentMethod)
    payPalSubscriptions(@Ctx() ctx: RequestContext): Promise<PayPalSubscription[]> {
        return this.subscriptionService.findAllLocal(ctx);
    }

    @Mutation()
    @Allow(Permission.CreatePaymentMethod)
    createPayPalBillingPlan(
        @Ctx() ctx: RequestContext,
        @Args('input') input: CreateBillingPlanInput,
    ): Promise<BillingPlanResult> {
        return this.subscriptionService.createBillingPlan(ctx, input);
    }

    @Mutation()
    @Allow(Permission.UpdatePaymentMethod)
    activatePayPalBillingPlan(
        @Ctx() ctx: RequestContext,
        @Args('planId') planId: string,
    ): Promise<boolean> {
        return this.subscriptionService.activateBillingPlan(ctx, planId);
    }

    @Mutation()
    @Allow(Permission.UpdatePaymentMethod)
    deactivatePayPalBillingPlan(
        @Ctx() ctx: RequestContext,
        @Args('planId') planId: string,
    ): Promise<boolean> {
        return this.subscriptionService.deactivateBillingPlan(ctx, planId);
    }

    @Mutation()
    @Allow(Permission.UpdatePaymentMethod)
    updatePayPalBillingPlanPricing(
        @Ctx() ctx: RequestContext,
        @Args('planId') planId: string,
        @Args('price') price: number,
        @Args('currencyCode') currencyCode: string,
    ): Promise<boolean> {
        return this.subscriptionService.updateBillingPlanPricing(ctx, planId, price, currencyCode);
    }

    @Mutation()
    @Allow(Permission.UpdatePaymentMethod)
    updatePayPalBillingPlanFailureThreshold(
        @Ctx() ctx: RequestContext,
        @Args('planId') planId: string,
        @Args('threshold') threshold: number,
    ): Promise<boolean> {
        return this.subscriptionService.updateBillingPlanFailureThreshold(ctx, planId, threshold);
    }

    @Mutation()
    @Allow(Permission.UpdatePaymentMethod)
    cancelPayPalSubscription(
        @Ctx() ctx: RequestContext,
        @Args('paypalSubscriptionId') paypalSubscriptionId: string,
        @Args('reason') reason: string,
    ): Promise<boolean> {
        return this.subscriptionService.cancelSubscription(ctx, paypalSubscriptionId, reason);
    }

    @Mutation()
    @Allow(Permission.UpdatePaymentMethod)
    async capturePayPalSubscription(
        @Ctx() ctx: RequestContext,
        @Args('paypalSubscriptionId') paypalSubscriptionId: string,
        @Args('amount') amount: number,
        @Args('currencyCode') currencyCode: string,
    ): Promise<string | null> {
        const result = await this.subscriptionService.captureSubscription(
            ctx,
            paypalSubscriptionId,
            amount,
            currencyCode,
        );
        return result.status ?? null;
    }

    @Mutation()
    @Allow(Permission.UpdatePaymentMethod)
    syncPayPalSubscription(
        @Ctx() ctx: RequestContext,
        @Args('paypalSubscriptionId') paypalSubscriptionId: string,
    ): Promise<string> {
        return this.subscriptionService.syncSubscription(ctx, paypalSubscriptionId);
    }
}
