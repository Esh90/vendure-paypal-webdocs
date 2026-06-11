import { ModuleRef } from '@nestjs/core';
import { Order, Payment, PaymentMethodService, RequestContext, TransactionalConnection } from '@vendure/core';
import Stripe from 'stripe';
import { VendureStripeClient } from './stripe-client';
import { StripePluginOptions } from './types';
export declare class StripeService {
    private options;
    private connection;
    private paymentMethodService;
    private moduleRef;
    constructor(options: StripePluginOptions, connection: TransactionalConnection, paymentMethodService: PaymentMethodService, moduleRef: ModuleRef);
    createPaymentIntent(ctx: RequestContext, order: Order): Promise<string>;
    constructEventFromPayload(ctx: RequestContext, order: Order, payload: Buffer, signature: string): Promise<Stripe.Event>;
    createRefund(ctx: RequestContext, order: Order, payment: Payment, amount: number): Promise<Stripe.Response<Stripe.Refund>>;
    /**
     * Get Stripe client based on eligible payment methods for order
     */
    getStripeClient(ctx: RequestContext, order: Order): Promise<VendureStripeClient>;
    private findOrThrowArgValue;
    /**
     * Returns the stripeCustomerId if the Customer has one. If that's not the case, queries Stripe to check
     * if the customer is already registered, in which case it saves the id as stripeCustomerId and returns it.
     * Otherwise, creates a new Customer record in Stripe and returns the generated id.
     */
    private getStripeCustomerId;
}
