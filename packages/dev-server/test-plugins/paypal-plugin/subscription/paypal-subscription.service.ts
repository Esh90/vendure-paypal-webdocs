import { Inject, Injectable } from '@nestjs/common';
import { ID, Logger, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import {
    ApplicationContextUserAction,
    CancelSubscriptionRequest,
    CaptureSubscriptionRequest,
    CaptureType,
    CreateSubscriptionRequest,
    Frequency,
    IntervalUnit,
    Patch,
    PatchOp,
    PaymentPreferences,
    PlanRequest,
    PlanRequestStatus,
    SubscriptionApplicationContext,
    SubscriptionBillingCycle,
    SubscriptionPricingScheme,
    TenureType,
    UpdatePricingSchemesRequest,
} from '@paypal/paypal-server-sdk';

import { loggerCtx, PAYPAL_PLUGIN_OPTIONS } from '../constants';
import { toPayPalAmount } from '../paypal-amount';
import { readBodyField, toReadablePayPalError } from '../paypal-errors';
import { PayPalClientService } from '../paypal.client';
import { PayPalPluginOptions } from '../types';
import { PayPalSubscription } from './entities/paypal-subscription.entity';
import {
    BillingPlanResult,
    CreateBillingPlanInput,
    CreateSubscriptionInput,
    PayPalIntervalUnit,
    SubscriptionResult,
} from './subscription-types';

const INTERVAL_UNIT_MAP: Record<PayPalIntervalUnit, IntervalUnit> = {
    DAY: IntervalUnit.Day,
    WEEK: IntervalUnit.Week,
    MONTH: IntervalUnit.Month,
    YEAR: IntervalUnit.Year,
};

/**
 * @description
 * Implements the PayPal subscription (recurring billing) use case. It wraps the PayPal
 * {@link SubscriptionsController} for the billing-plan and subscription lifecycle, and mirrors
 * subscription state into the local {@link PayPalSubscription} entity for admin listing and
 * scheduled synchronisation.
 */
@Injectable()
export class PayPalSubscriptionService {
    constructor(
        private readonly clientService: PayPalClientService,
        private readonly connection: TransactionalConnection,
        @Inject(PAYPAL_PLUGIN_OPTIONS) private readonly options: PayPalPluginOptions,
    ) {}

    // --- Billing plan lifecycle (merchant) ---------------------------------------------------

    /**
     * Creates a PayPal billing plan that defines the recurring price and interval. Optionally
     * creates it directly in the `ACTIVE` state so subscriptions can be taken against it.
     */
    async createBillingPlan(
        ctx: RequestContext,
        input: CreateBillingPlanInput,
    ): Promise<BillingPlanResult> {
        if (input.price <= 0) {
            throw new UserInputError('Billing plan price must be a positive amount');
        }
        const { returnUrl, cancelUrl } = this.clientService.getRedirectUrls();
        const frequency: Frequency = {
            intervalUnit: INTERVAL_UNIT_MAP[input.intervalUnit],
            intervalCount: input.intervalCount ?? 1,
        };
        const billingCycle: SubscriptionBillingCycle = {
            tenureType: TenureType.Regular,
            sequence: 1,
            totalCycles: input.totalCycles ?? 0,
            frequency,
            pricingScheme: {
                fixedPrice: {
                    currencyCode: input.currencyCode,
                    value: toPayPalAmount(input.price, input.currencyCode),
                },
            },
        };
        const paymentPreferences: PaymentPreferences = {
            autoBillOutstanding: input.autoBillOutstanding ?? true,
            paymentFailureThreshold: input.paymentFailureThreshold ?? 1,
        };
        const body: PlanRequest = {
            productId: input.productId,
            name: input.name,
            description: input.description,
            status: input.activate ? PlanRequestStatus.Active : PlanRequestStatus.Created,
            billingCycles: [billingCycle],
            paymentPreferences,
            merchantPreferences: {
                ...(returnUrl ? { returnUrl } : {}),
                ...(cancelUrl ? { cancelUrl } : {}),
            },
        };
        try {
            const { result } = await this.clientService
                .getSubscriptionsController()
                .createBillingPlan({ body, prefer: 'return=representation' });
            if (!result.id) {
                throw new Error('PayPal did not return a billing plan ID');
            }
            Logger.info(`Created PayPal billing plan ${result.id} (${result.status})`, loggerCtx);
            return { id: result.id, name: result.name, status: result.status ?? 'CREATED' };
        } catch (e) {
            throw toReadablePayPalError(e, `create PayPal billing plan "${input.name}"`, loggerCtx);
        }
    }

    /** Activates a billing plan so that it can accept new subscriptions. */
    async activateBillingPlan(ctx: RequestContext, planId: string): Promise<boolean> {
        try {
            await this.clientService.getSubscriptionsController().activateBillingPlan(planId);
            Logger.info(`Activated PayPal billing plan ${planId}`, loggerCtx);
            return true;
        } catch (e) {
            throw toReadablePayPalError(e, `activate PayPal billing plan ${planId}`, loggerCtx);
        }
    }

    /** Deactivates a billing plan, preventing new subscriptions against it. */
    async deactivateBillingPlan(ctx: RequestContext, planId: string): Promise<boolean> {
        try {
            await this.clientService.getSubscriptionsController().deactivateBillingPlan(planId);
            Logger.info(`Deactivated PayPal billing plan ${planId}`, loggerCtx);
            return true;
        } catch (e) {
            throw toReadablePayPalError(e, `deactivate PayPal billing plan ${planId}`, loggerCtx);
        }
    }

    /** Lists billing plans, optionally filtered by the catalog product they belong to. */
    async listBillingPlans(
        ctx: RequestContext,
        productId?: string,
    ): Promise<BillingPlanResult[]> {
        try {
            const { result } = await this.clientService.getSubscriptionsController().listBillingPlans({
                productId,
                pageSize: 20,
                totalRequired: true,
            });
            return (result.plans ?? [])
                .filter(plan => !!plan.id)
                .map(plan => ({
                    id: plan.id as string,
                    name: plan.name,
                    status: plan.status ?? 'UNKNOWN',
                }));
        } catch (e) {
            throw toReadablePayPalError(e, 'list PayPal billing plans', loggerCtx);
        }
    }

    /** Updates the recurring price of a billing plan's regular billing cycle. */
    async updateBillingPlanPricing(
        ctx: RequestContext,
        planId: string,
        price: number,
        currencyCode: string,
    ): Promise<boolean> {
        if (price <= 0) {
            throw new UserInputError('Billing plan price must be a positive amount');
        }
        const pricingScheme: SubscriptionPricingScheme = {
            fixedPrice: { currencyCode, value: toPayPalAmount(price, currencyCode) },
        };
        const body: UpdatePricingSchemesRequest = {
            pricingSchemes: [{ billingCycleSequence: 1, pricingScheme }],
        };
        try {
            await this.clientService
                .getSubscriptionsController()
                .updateBillingPlanPricingSchemes({ id: planId, body });
            Logger.info(`Updated pricing for PayPal billing plan ${planId}`, loggerCtx);
            return true;
        } catch (e) {
            throw toReadablePayPalError(e, `update pricing for PayPal billing plan ${planId}`, loggerCtx);
        }
    }

    /** Updates the consecutive-failure threshold after which a subscription is suspended. */
    async updateBillingPlanFailureThreshold(
        ctx: RequestContext,
        planId: string,
        threshold: number,
    ): Promise<boolean> {
        if (!Number.isInteger(threshold) || threshold < 0) {
            throw new UserInputError('Payment failure threshold must be a non-negative integer');
        }
        const patch: Patch[] = [
            {
                op: PatchOp.Replace,
                path: '/payment_preferences/payment_failure_threshold',
                value: threshold,
            },
        ];
        try {
            await this.clientService
                .getSubscriptionsController()
                .patchBillingPlan({ id: planId, body: patch });
            Logger.info(
                `Updated payment failure threshold for PayPal billing plan ${planId} to ${threshold}`,
                loggerCtx,
            );
            return true;
        } catch (e) {
            throw toReadablePayPalError(
                e,
                `update failure threshold for PayPal billing plan ${planId}`,
                loggerCtx,
            );
        }
    }

    // --- Subscription lifecycle (customer) ---------------------------------------------------

    /**
     * Creates a subscription against a billing plan and returns the approval URL the subscriber
     * must visit to authorise the recurring charges. The subscription is mirrored locally with its
     * initial status (typically `APPROVAL_PENDING`).
     */
    async createSubscription(
        ctx: RequestContext,
        input: CreateSubscriptionInput,
    ): Promise<SubscriptionResult> {
        // The subscriber is redirected to these URLs after approving/cancelling. Without them the
        // PayPal approval page would hang after approval (same constraint as the checkout flow).
        const { returnUrl, cancelUrl } = this.clientService.getRedirectUrls();
        if (!returnUrl || !cancelUrl) {
            throw new UserInputError(
                'PayPal subscriptions require returnUrl and cancelUrl to be configured on ' +
                    'PayPalPlugin.init() (or PAYPAL_* env vars).',
            );
        }
        const applicationContext: SubscriptionApplicationContext = {
            brandName: this.clientService.getBrandName(),
            userAction: ApplicationContextUserAction.SubscribeNow,
            returnUrl,
            cancelUrl,
        };
        const body: CreateSubscriptionRequest = {
            planId: input.planId,
            ...(input.startTime ? { startTime: input.startTime } : {}),
            ...(input.customId ? { customId: input.customId } : {}),
            ...(input.subscriberEmail ? { subscriber: { emailAddress: input.subscriberEmail } } : {}),
            applicationContext,
        };

        let subscriptionId: string;
        let status: string;
        let approveUrl: string | undefined;
        try {
            const response = await this.clientService
                .getSubscriptionsController()
                .createSubscription({ body, prefer: 'return=representation' });
            const result = response.result;
            if (!result.id) {
                throw new Error('PayPal did not return a subscription ID');
            }
            subscriptionId = result.id;
            status = readBodyField(response.body, 'status') ?? 'APPROVAL_PENDING';
            approveUrl = result.links?.find(link => link.rel === 'approve')?.href;
        } catch (e) {
            throw toReadablePayPalError(
                e,
                `create PayPal subscription for plan ${input.planId}`,
                loggerCtx,
            );
        }

        await this.upsertLocalSubscription(ctx, {
            paypalSubscriptionId: subscriptionId,
            planId: input.planId,
            status,
            subscriberEmail: input.subscriberEmail,
            customId: input.customId,
            startTime: input.startTime,
        });
        Logger.info(`Created PayPal subscription ${subscriptionId} (${status})`, loggerCtx);
        return { id: subscriptionId, status, approveUrl };
    }

    /**
     * Fetches the current status of a subscription from PayPal and updates the local mirror.
     * Returns the up-to-date status.
     */
    async syncSubscription(ctx: RequestContext, paypalSubscriptionId: string): Promise<string> {
        let status: string | undefined;
        try {
            const response = await this.clientService
                .getSubscriptionsController()
                .getSubscription({ id: paypalSubscriptionId });
            status = readBodyField(response.body, 'status');
        } catch (e) {
            throw toReadablePayPalError(e, `read PayPal subscription ${paypalSubscriptionId}`, loggerCtx);
        }
        if (!status) {
            throw new Error(`PayPal subscription ${paypalSubscriptionId} returned no status`);
        }
        await this.updateLocalStatus(ctx, paypalSubscriptionId, status);
        return status;
    }

    /** Cancels an active subscription, stopping all future charges. */
    async cancelSubscription(
        ctx: RequestContext,
        paypalSubscriptionId: string,
        reason: string,
    ): Promise<boolean> {
        const body: CancelSubscriptionRequest = { reason };
        try {
            await this.clientService
                .getSubscriptionsController()
                .cancelSubscription({ id: paypalSubscriptionId, body });
        } catch (e) {
            throw toReadablePayPalError(
                e,
                `cancel PayPal subscription ${paypalSubscriptionId}`,
                loggerCtx,
            );
        }
        await this.updateLocalStatus(ctx, paypalSubscriptionId, 'CANCELLED');
        Logger.info(`Cancelled PayPal subscription ${paypalSubscriptionId}`, loggerCtx);
        return true;
    }

    /**
     * Manually charges the subscriber for the outstanding balance (e.g. to retry a failed payment).
     * Returns the resulting transaction status, when available.
     */
    async captureSubscription(
        ctx: RequestContext,
        paypalSubscriptionId: string,
        amountMinorUnits: number,
        currencyCode: string,
        note = 'Outstanding balance charge',
    ): Promise<{ status?: string }> {
        if (amountMinorUnits <= 0) {
            throw new UserInputError('Capture amount must be a positive value');
        }
        const body: CaptureSubscriptionRequest = {
            note,
            captureType: CaptureType.OutstandingBalance,
            amount: { currencyCode, value: toPayPalAmount(amountMinorUnits, currencyCode) },
        };
        try {
            const { result } = await this.clientService
                .getSubscriptionsController()
                .captureSubscription({ id: paypalSubscriptionId, body });
            Logger.info(
                `Captured outstanding balance for PayPal subscription ${paypalSubscriptionId} ` +
                    `(${note})`,
                loggerCtx,
            );
            return { status: result?.status };
        } catch (e) {
            throw toReadablePayPalError(
                e,
                `capture outstanding balance for PayPal subscription ${paypalSubscriptionId}`,
                loggerCtx,
            );
        }
    }

    // --- Local mirror helpers ----------------------------------------------------------------

    /** Returns all locally-tracked subscriptions, most-recent first (for admin listing). */
    async findAllLocal(ctx: RequestContext): Promise<PayPalSubscription[]> {
        return this.connection
            .getRepository(ctx, PayPalSubscription)
            .find({ order: { createdAt: 'DESC' } });
    }

    /**
     * Returns the PayPal subscription IDs of all locally-tracked subscriptions that are not in a
     * terminal state, used by the scheduled sync task.
     */
    async findSyncableIds(ctx: RequestContext): Promise<string[]> {
        const subscriptions = await this.connection.getRepository(ctx, PayPalSubscription).find();
        const terminal = new Set(['CANCELLED', 'EXPIRED']);
        return subscriptions
            .filter(sub => !terminal.has(sub.status))
            .map(sub => sub.paypalSubscriptionId);
    }

    private async upsertLocalSubscription(
        ctx: RequestContext,
        data: {
            paypalSubscriptionId: string;
            planId: string;
            status: string;
            subscriberEmail?: string;
            customId?: string;
            startTime?: string;
        },
    ): Promise<void> {
        const repo = this.connection.getRepository(ctx, PayPalSubscription);
        const existing = await repo.findOne({
            where: { paypalSubscriptionId: data.paypalSubscriptionId },
        });
        if (existing) {
            await repo.save({ ...existing, ...data });
        } else {
            await repo.save(new PayPalSubscription(data));
        }
    }

    private async updateLocalStatus(
        ctx: RequestContext,
        paypalSubscriptionId: string,
        status: string,
    ): Promise<void> {
        const repo = this.connection.getRepository(ctx, PayPalSubscription);
        const existing = await repo.findOne({ where: { paypalSubscriptionId } });
        if (existing && existing.status !== status) {
            existing.status = status;
            await repo.save(existing);
        }
    }
}
