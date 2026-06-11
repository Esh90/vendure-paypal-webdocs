import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { PayPalReportingService } from '../paypal-reporting.service';
import {
    PayPalBalancesReport,
    PayPalTransactionReport,
    TransactionSearchInput,
} from '../reporting-types';

@Resolver()
export class PayPalReportingAdminResolver {
    constructor(private readonly reportingService: PayPalReportingService) {}

    @Query()
    @Allow(Permission.ReadPaymentMethod)
    payPalTransactions(
        @Ctx() ctx: RequestContext,
        @Args('input') input: TransactionSearchInput,
    ): Promise<PayPalTransactionReport> {
        return this.reportingService.searchTransactions(ctx, input);
    }

    @Query()
    @Allow(Permission.ReadPaymentMethod)
    payPalBalances(
        @Ctx() ctx: RequestContext,
        @Args('asOfTime') asOfTime?: string,
        @Args('currencyCode') currencyCode?: string,
    ): Promise<PayPalBalancesReport> {
        return this.reportingService.getBalances(ctx, asOfTime, currencyCode);
    }
}
