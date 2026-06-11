import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { DocumentNode, Kind } from 'graphql';

import { shopApiExtensions } from './api/api-extensions';
import { PayPalShopResolver } from './api/paypal-shop.resolver';
import { PAYPAL_PLUGIN_OPTIONS } from './constants';
import { paypalPaymentHandler } from './paypal.handler';
import { PayPalClientService } from './paypal.client';
import { PayPalService } from './paypal.service';
import {
    adminSubscriptionApiExtensions,
    shopSubscriptionApiExtensions,
} from './subscription/api/subscription-api-extensions';
import { PayPalSubscriptionAdminResolver } from './subscription/api/subscription-admin.resolver';
import { PayPalSubscriptionShopResolver } from './subscription/api/subscription-shop.resolver';
import { PayPalSubscription } from './subscription/entities/paypal-subscription.entity';
import { PayPalSubscriptionService } from './subscription/paypal-subscription.service';
import { paypalSubscriptionSyncTask } from './subscription/paypal-subscription.task';
import { PayPalPluginOptions } from './types';

/** Merges multiple GraphQL `DocumentNode`s into one. */
function mergeDocuments(...documents: DocumentNode[]): DocumentNode {
    return {
        kind: Kind.DOCUMENT,
        definitions: documents.flatMap(doc => doc.definitions),
    };
}

/**
 * @description
 * A self-contained Vendure plugin that integrates PayPal as a payment provider.
 *
 * Covered use cases:
 *  - Standard checkout with immediate capture (UC1) and authorize-then-capture (UC2), via the
 *    {@link paypalPaymentHandler} and the `createPayPalCheckout` Shop API mutation.
 *  - Payment void (UC3), full and partial refunds (UC4/UC5), via the handler lifecycle methods.
 *  - Subscription billing (UC6): a dedicated module with its own entity, service, GraphQL
 *    resolvers, and a scheduled task that reconciles subscription status with PayPal.
 *
 * Register a Vendure PaymentMethod that uses the `paypal` handler to enable the checkout flows.
 *
 * @example
 * ```ts
 * PayPalPlugin.init({
 *   // credentials/environment fall back to PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET /
 *   // PAYPAL_ENVIRONMENT when omitted here
 *   environment: 'sandbox',
 *   brandName: 'My Store',
 *   returnUrl: 'https://my-store.example/checkout/confirm',
 *   cancelUrl: 'https://my-store.example/checkout',
 * }),
 * ```
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [PayPalSubscription],
    providers: [
        PayPalClientService,
        PayPalService,
        PayPalSubscriptionService,
        {
            provide: PAYPAL_PLUGIN_OPTIONS,
            useFactory: () => PayPalPlugin.options,
        },
    ],
    shopApiExtensions: {
        schema: mergeDocuments(shopApiExtensions, shopSubscriptionApiExtensions),
        resolvers: [PayPalShopResolver, PayPalSubscriptionShopResolver],
    },
    adminApiExtensions: {
        schema: adminSubscriptionApiExtensions,
        resolvers: [PayPalSubscriptionAdminResolver],
    },
    configuration: config => {
        config.paymentOptions.paymentMethodHandlers.push(paypalPaymentHandler);
        config.schedulerOptions.tasks.push(paypalSubscriptionSyncTask);
        return config;
    },
    compatibility: '>=3.0.0',
})
export class PayPalPlugin {
    static options: PayPalPluginOptions = {};

    /**
     * Configure the PayPal plugin. All fields are optional and fall back to the corresponding
     * environment variables — see {@link PayPalPluginOptions}.
     */
    static init(options: PayPalPluginOptions): Type<PayPalPlugin> {
        this.options = options ?? {};
        return PayPalPlugin;
    }
}
