import { ActiveOrderService, RequestContext } from '@vendure/core';
import { StripeService } from './stripe.service';
export declare class StripeResolver {
    private stripeService;
    private activeOrderService;
    constructor(stripeService: StripeService, activeOrderService: ActiveOrderService);
    createStripePaymentIntent(ctx: RequestContext): Promise<string>;
}
