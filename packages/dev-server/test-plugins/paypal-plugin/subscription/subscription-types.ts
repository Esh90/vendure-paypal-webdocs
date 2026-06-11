/**
 * Input/result types for the PayPal subscription module (Use Case 6).
 */

/** The billing interval unit for a plan, mirroring PayPal's `IntervalUnit`. */
export type PayPalIntervalUnit = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

export interface CreateBillingPlanInput {
    /** The ID of a PayPal Catalog Product the plan belongs to. */
    productId: string;
    /** The plan name shown to the merchant and (optionally) the subscriber. */
    name: string;
    /** An optional plan description. */
    description?: string;
    /** The billing interval unit. */
    intervalUnit: PayPalIntervalUnit;
    /** How many interval units between charges (default `1`). */
    intervalCount?: number;
    /** The recurring price, in Vendure integer minor units (e.g. `1000` = $10.00). */
    price: number;
    /** The ISO-4217 currency code for the price. */
    currencyCode: string;
    /** Number of billing cycles to run; `0` (default) means bill indefinitely. */
    totalCycles?: number;
    /** Consecutive failed payments tolerated before the subscription is suspended (default `1`). */
    paymentFailureThreshold?: number;
    /** Whether unpaid outstanding balances are automatically billed on the next cycle (default `true`). */
    autoBillOutstanding?: boolean;
    /** Create the plan in the `ACTIVE` state immediately (default `false` → `CREATED`). */
    activate?: boolean;
}

export interface BillingPlanResult {
    id: string;
    name?: string;
    status: string;
}

export interface CreateSubscriptionInput {
    /** The PayPal billing plan ID to subscribe to. */
    planId: string;
    /** The subscriber's email address. */
    subscriberEmail?: string;
    /** An optional custom identifier (e.g. a Vendure order code). */
    customId?: string;
    /** Optional ISO-8601 start time; defaults to immediate. */
    startTime?: string;
}

export interface SubscriptionResult {
    id: string;
    status: string;
    approveUrl?: string;
}
