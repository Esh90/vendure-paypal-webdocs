import { Logger, RequestContextService, ScheduledTask } from '@vendure/core';

import { loggerCtx } from '../constants';
import { PayPalSubscriptionService } from './paypal-subscription.service';

/**
 * @description
 * A scheduled task (Use Case 6 — management) that periodically reconciles the local
 * {@link PayPalSubscription} mirror with PayPal. PayPal charges subscriptions automatically on each
 * billing cycle and updates their status (e.g. `ACTIVE` → `SUSPENDED` after repeated payment
 * failures); this task pulls those status changes into Vendure so the admin always sees current
 * data. Subscriptions in a terminal state (`CANCELLED`, `EXPIRED`) are skipped.
 *
 * Runs hourly by default. Registered via `config.schedulerOptions.tasks` by the {@link PayPalPlugin}.
 */
export const paypalSubscriptionSyncTask = new ScheduledTask({
    id: 'paypal-subscription-sync',
    description: 'Synchronise PayPal subscription statuses into the local mirror',
    // Every hour, on the hour.
    schedule: '0 * * * *',
    async execute({ injector }) {
        const subscriptionService = injector.get(PayPalSubscriptionService);
        const requestContextService = injector.get(RequestContextService);
        const ctx = await requestContextService.create({ apiType: 'admin' });

        const ids = await subscriptionService.findSyncableIds(ctx);
        let synced = 0;
        for (const id of ids) {
            try {
                await subscriptionService.syncSubscription(ctx, id);
                synced++;
            } catch (e) {
                Logger.warn(
                    `Failed to sync PayPal subscription ${id}: ${
                        e instanceof Error ? e.message : String(e)
                    }`,
                    loggerCtx,
                );
            }
        }
        return { total: ids.length, synced };
    },
});
