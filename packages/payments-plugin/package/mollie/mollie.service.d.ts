import { ModuleRef } from '@nestjs/core';
import { ActiveOrderService, EntityHydrator, Order, OrderService, PaymentMethodService, RequestContext } from '@vendure/core';
import { MolliePaymentIntentInput, MolliePaymentIntentResult, MolliePaymentMethod } from './graphql/generated-shop-types';
import { MolliePluginOptions } from './mollie.plugin';
import { MolliePaymentMetadata } from './types';
interface OrderStatusInput {
    paymentMethodId: string;
    paymentId: string;
}
export declare class MollieService {
    private paymentMethodService;
    private options;
    private activeOrderService;
    private orderService;
    private entityHydrator;
    private moduleRef;
    private readonly injector;
    constructor(paymentMethodService: PaymentMethodService, options: MolliePluginOptions, activeOrderService: ActiveOrderService, orderService: OrderService, entityHydrator: EntityHydrator, moduleRef: ModuleRef);
    /**
     * Creates a redirectUrl to Mollie for the given paymentMethod and current activeOrder
     */
    createPaymentIntent(ctx: RequestContext, input: MolliePaymentIntentInput): Promise<MolliePaymentIntentResult>;
    /**
     * Update Vendure payments and order status based on the incoming Mollie payment
     */
    handleMollieStatusUpdate(ctx: RequestContext, { paymentMethodId, paymentId }: OrderStatusInput): Promise<void>;
    /**
     * Add payment to order. Can be settled or authorized depending on the payment method.
     */
    addPayment(ctx: RequestContext, order: Order, amount: number, mollieMetadata: Omit<MolliePaymentMetadata, 'status' | 'amount'>, paymentMethodCode: string, status: 'Authorized' | 'Settled'): Promise<Order>;
    /**
     * Settle an existing payment based on the given Mollie payment ID
     */
    settleExistingPayment(ctx: RequestContext, order: Order, molliePaymentId: string): Promise<void>;
    getEnabledPaymentMethods(ctx: RequestContext, paymentMethodCode: string): Promise<MolliePaymentMethod[]>;
    /**
     * Dry run a transition to a given state.
     * As long as we don't call 'finalize', the transition never completes.
     */
    private canTransitionTo;
    private getPaymentMethod;
    /**
     * Get order by id, or active order if no orderId is given.
     *
     * Fetches order with all needed relations
     */
    private getOrder;
}
export {};
