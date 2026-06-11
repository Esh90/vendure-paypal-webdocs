import { RequestContext } from '@vendure/core';
import { MolliePaymentIntent, MolliePaymentIntentError, MolliePaymentIntentInput, MolliePaymentIntentResult } from './graphql/generated-shop-types';
import { MollieService } from './mollie.service';
export declare class MollieCommonResolver {
    private mollieService;
    constructor(mollieService: MollieService);
    createMolliePaymentIntent(ctx: RequestContext, input: MolliePaymentIntentInput): Promise<MolliePaymentIntentResult>;
    __resolveType(value: MolliePaymentIntentError | MolliePaymentIntent): string;
}
