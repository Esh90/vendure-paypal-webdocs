/**
 * Result types for the PayPal transaction reporting module (Use Case 7). These are plain shapes
 * returned by the service and exposed via the Admin API; no Vendure entities are involved — data is
 * fetched live from PayPal.
 */

export interface PayPalMoneyDto {
    currencyCode: string;
    value: string;
}

export interface PayPalTransactionDto {
    transactionId?: string;
    status?: string;
    eventCode?: string;
    initiationDate?: string;
    updatedDate?: string;
    amount?: PayPalMoneyDto;
    feeAmount?: PayPalMoneyDto;
    payerEmail?: string;
    payerName?: string;
}

export interface PayPalTransactionReport {
    startDate: string;
    endDate: string;
    totalCount: number;
    /** True when the requested range was longer than the supported window cap and was truncated. */
    truncated: boolean;
    transactions: PayPalTransactionDto[];
}

export interface PayPalBalanceDto {
    currencyCode?: string;
    primary?: boolean;
    availableBalance?: PayPalMoneyDto;
    withheldBalance?: PayPalMoneyDto;
}

export interface PayPalBalancesReport {
    asOfTime?: string;
    lastRefreshTime?: string;
    balances: PayPalBalanceDto[];
}

export interface TransactionSearchInput {
    /** ISO-8601 start of the range (inclusive). */
    startDate: string;
    /** ISO-8601 end of the range (inclusive). */
    endDate: string;
    /** Filter to a single PayPal transaction ID. */
    transactionId?: string;
    /** Filter by transaction status (e.g. `S` = success, `P` = pending, `V` = reversed). */
    transactionStatus?: string;
    /** Page size per PayPal request (1–500, default 100). */
    pageSize?: number;
}
