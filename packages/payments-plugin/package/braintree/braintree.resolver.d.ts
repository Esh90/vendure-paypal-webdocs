import { ActiveOrderService, ID, OrderService, RequestContext, TransactionalConnection } from '@vendure/core';
import { BraintreePluginOptions } from './types';
export declare class BraintreeResolver {
    private connection;
    private orderService;
    private activeOrderService;
    private options;
    constructor(connection: TransactionalConnection, orderService: OrderService, activeOrderService: ActiveOrderService, options: BraintreePluginOptions);
    generateBraintreeClientToken(ctx: RequestContext, { orderId, includeCustomerId }: {
        orderId?: ID;
        includeCustomerId?: boolean;
    }): Promise<string>;
    private getPaymentMethodArgs;
}
