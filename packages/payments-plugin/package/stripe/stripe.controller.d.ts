import { ChannelService, OrderService, PaymentMethodService, RequestContextService, TransactionalConnection } from '@vendure/core';
import type { Response } from 'express';
import { StripeService } from './stripe.service';
import { RequestWithRawBody, StripePluginOptions } from './types';
export declare class StripeController {
    private options;
    private paymentMethodService;
    private orderService;
    private stripeService;
    private requestContextService;
    private connection;
    private channelService;
    constructor(options: StripePluginOptions, paymentMethodService: PaymentMethodService, orderService: OrderService, stripeService: StripeService, requestContextService: RequestContextService, connection: TransactionalConnection, channelService: ChannelService);
    webhook(signature: string | undefined, request: RequestWithRawBody, response: Response): Promise<void>;
    private createContext;
    private getPaymentMethod;
}
