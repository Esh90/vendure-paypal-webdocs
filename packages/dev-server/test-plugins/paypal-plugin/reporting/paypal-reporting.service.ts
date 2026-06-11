import { Injectable } from '@nestjs/common';
import { Logger, RequestContext, UserInputError } from '@vendure/core';
import { Money, TransactionDetails } from '@paypal/paypal-server-sdk';

import { loggerCtx } from '../constants';
import { toReadablePayPalError } from '../paypal-errors';
import { PayPalClientService } from '../paypal.client';
import {
    PayPalBalancesReport,
    PayPalMoneyDto,
    PayPalTransactionDto,
    PayPalTransactionReport,
    TransactionSearchInput,
} from './reporting-types';

/** PayPal limits a single transaction-search query to a 31-day window. */
const MAX_WINDOW_MS = 31 * 24 * 60 * 60 * 1000;
/** Safety cap on the number of stitched windows (≈ 1 year). Longer ranges are truncated + logged. */
const MAX_WINDOWS = 12;
/** Safety cap on pages fetched per window. */
const MAX_PAGES_PER_WINDOW = 50;
const DEFAULT_PAGE_SIZE = 100;

/**
 * @description
 * Proxies PayPal's transaction-search and balances reporting APIs for reconciliation and accounting
 * (Use Case 7). No Vendure entities are involved — data is fetched live from PayPal.
 *
 * Notes derived from PayPal's reporting constraints:
 *  - Transactions can appear up to ~3 hours after execution, so this is not suitable for real-time
 *    payment confirmation.
 *  - A single query supports at most a 31-day range; longer ranges are split into ≤31-day windows
 *    and stitched together (bounded by {@link MAX_WINDOWS}).
 */
@Injectable()
export class PayPalReportingService {
    constructor(private readonly clientService: PayPalClientService) {}

    /**
     * Searches transactions across an arbitrary date range, transparently splitting it into
     * ≤31-day windows and paginating each.
     */
    async searchTransactions(
        ctx: RequestContext,
        input: TransactionSearchInput,
    ): Promise<PayPalTransactionReport> {
        const start = new Date(input.startDate);
        const end = new Date(input.endDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            throw new UserInputError('startDate and endDate must be valid ISO-8601 date-times');
        }
        if (start.getTime() >= end.getTime()) {
            throw new UserInputError('startDate must be earlier than endDate');
        }
        const pageSize = this.clampPageSize(input.pageSize);

        const { windows, truncated } = this.buildWindows(start, end);
        if (truncated) {
            Logger.warn(
                `Transaction search range exceeds ${MAX_WINDOWS} windows (~${MAX_WINDOWS} months); ` +
                    'results are truncated to the earliest portion of the range.',
                loggerCtx,
            );
        }

        const transactions: PayPalTransactionDto[] = [];
        const controller = this.clientService.getTransactionSearchController();
        for (const window of windows) {
            let page = 1;
            let totalPages = 1;
            do {
                let response;
                try {
                    response = await controller.searchTransactions({
                        startDate: window.from.toISOString(),
                        endDate: window.to.toISOString(),
                        fields: 'all',
                        pageSize,
                        page,
                        ...(input.transactionId ? { transactionId: input.transactionId } : {}),
                        ...(input.transactionStatus
                            ? { transactionStatus: input.transactionStatus }
                            : {}),
                    });
                } catch (e) {
                    throw toReadablePayPalError(e, 'search PayPal transactions', loggerCtx);
                }
                const result = response.result;
                for (const detail of result.transactionDetails ?? []) {
                    transactions.push(this.toTransactionDto(detail));
                }
                totalPages = result.totalPages ?? 1;
                page++;
            } while (page <= totalPages && page <= MAX_PAGES_PER_WINDOW);
        }

        return {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            totalCount: transactions.length,
            truncated,
            transactions,
        };
    }

    /**
     * Returns the PayPal account balances, optionally as of a point in time and/or for a single
     * currency.
     */
    async getBalances(
        ctx: RequestContext,
        asOfTime?: string,
        currencyCode?: string,
    ): Promise<PayPalBalancesReport> {
        if (asOfTime && Number.isNaN(new Date(asOfTime).getTime())) {
            throw new UserInputError('asOfTime must be a valid ISO-8601 date-time');
        }
        try {
            const { result } = await this.clientService.getTransactionSearchController().searchBalances({
                ...(asOfTime ? { asOfTime: new Date(asOfTime).toISOString() } : {}),
                ...(currencyCode ? { currencyCode } : {}),
            });
            return {
                asOfTime: result.asOfTime,
                lastRefreshTime: result.lastRefreshTime,
                balances: (result.balances ?? []).map(balance => ({
                    currencyCode:
                        balance.availableBalance?.currencyCode ?? balance.withheldBalance?.currencyCode,
                    primary: balance.primary,
                    availableBalance: this.toMoneyDto(balance.availableBalance),
                    withheldBalance: this.toMoneyDto(balance.withheldBalance),
                })),
            };
        } catch (e) {
            throw toReadablePayPalError(e, 'fetch PayPal balances', loggerCtx);
        }
    }

    private buildWindows(
        start: Date,
        end: Date,
    ): { windows: Array<{ from: Date; to: Date }>; truncated: boolean } {
        const windows: Array<{ from: Date; to: Date }> = [];
        let cursor = start.getTime();
        const endMs = end.getTime();
        while (cursor < endMs && windows.length < MAX_WINDOWS) {
            const to = Math.min(cursor + MAX_WINDOW_MS, endMs);
            windows.push({ from: new Date(cursor), to: new Date(to) });
            cursor = to;
        }
        return { windows, truncated: cursor < endMs };
    }

    private clampPageSize(pageSize?: number): number {
        if (!pageSize || !Number.isFinite(pageSize)) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(Math.max(Math.trunc(pageSize), 1), 500);
    }

    private toTransactionDto(detail: TransactionDetails): PayPalTransactionDto {
        const info = detail.transactionInfo;
        const payer = detail.payerInfo;
        const joinedName = [payer?.payerName?.givenName, payer?.payerName?.surname]
            .filter(Boolean)
            .join(' ');
        const payerName =
            payer?.payerName?.alternateFullName ??
            payer?.payerName?.fullName ??
            (joinedName.length > 0 ? joinedName : undefined);
        return {
            transactionId: info?.transactionId,
            status: info?.transactionStatus,
            eventCode: info?.transactionEventCode,
            initiationDate: info?.transactionInitiationDate,
            updatedDate: info?.transactionUpdatedDate,
            amount: this.toMoneyDto(info?.transactionAmount),
            feeAmount: this.toMoneyDto(info?.feeAmount),
            payerEmail: payer?.emailAddress,
            payerName,
        };
    }

    private toMoneyDto(money?: Money): PayPalMoneyDto | undefined {
        if (!money || money.currencyCode == null || money.value == null) {
            return undefined;
        }
        return { currencyCode: money.currencyCode, value: money.value };
    }
}
