import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';

import { shopApiExtensions } from './api/api-extensions';
import { PayPalShopResolver } from './api/paypal-shop.resolver';
import { PAYPAL_PLUGIN_OPTIONS } from './constants';
import { PayPalClientService } from './paypal.client';
import { paypalPaymentHandler } from './paypal.handler';
import { PayPalService } from './paypal.service';
import { PayPalPluginOptions } from './types';

/**
 * @description
 * A self-contained Vendure plugin that integrates PayPal as a payment provider.
 *
 * This iteration covers Use Case 1 — standard checkout with immediate capture:
 *
 *  1. The storefront calls the `createPayPalCheckout` Shop API mutation, which creates a PayPal
 *     order with `CAPTURE` intent and returns the buyer approval URL.
 *  2. The buyer approves the payment on PayPal (redirect or embedded JS SDK flow).
 *  3. The storefront calls `addPaymentToOrder` with the PayPal method code and the approved order
 *     ID in `metadata.paypalOrderId`; the {@link paypalPaymentHandler} captures the funds and the
 *     Vendure Payment is settled.
 *
 * Register a Vendure PaymentMethod that uses the `paypal` handler to enable the flow.
 *
 * @example
 * ```ts
 * PayPalPlugin.init({
 *   // credentials/environment fall back to PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET /
 *   // PAYPAL_ENVIRONMENT when omitted here
 *   environment: 'sandbox',
 *   brandName: 'My Store',
 * }),
 * ```
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        PayPalClientService,
        PayPalService,
        {
            provide: PAYPAL_PLUGIN_OPTIONS,
            useFactory: () => PayPalPlugin.options,
        },
    ],
    shopApiExtensions: {
        schema: shopApiExtensions,
        resolvers: [PayPalShopResolver],
    },
    configuration: config => {
        config.paymentOptions.paymentMethodHandlers.push(paypalPaymentHandler);
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
