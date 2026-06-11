import { RequestContext } from '@vendure/core';
import { MolliePaymentMethod, MolliePaymentMethodsInput } from './graphql/generated-shop-types';
import { MollieService } from './mollie.service';
export declare class MollieShopResolver {
    private mollieService;
    constructor(mollieService: MollieService);
    molliePaymentMethods(ctx: RequestContext, { paymentMethodCode }: MolliePaymentMethodsInput): Promise<MolliePaymentMethod[]>;
}
