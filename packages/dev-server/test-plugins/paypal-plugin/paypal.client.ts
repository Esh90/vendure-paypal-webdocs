import { Inject, Injectable } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { Client, Environment, OrdersController } from '@paypal/paypal-server-sdk';

import { loggerCtx, PAYPAL_PLUGIN_OPTIONS } from './constants';
import { PayPalPluginOptions } from './types';

/**
 * @description
 * Builds and caches the PayPal Server SDK {@link Client} and its controllers.
 *
 * The client is created lazily on first use so that a missing-credentials misconfiguration surfaces
 * as a clear runtime error on the first PayPal call rather than crashing application bootstrap. The
 * underlying OAuth 2.0 access token is obtained and refreshed automatically by the SDK.
 */
@Injectable()
export class PayPalClientService {
    private client: Client | undefined;
    private ordersController: OrdersController | undefined;

    constructor(@Inject(PAYPAL_PLUGIN_OPTIONS) private readonly options: PayPalPluginOptions) {}

    /**
     * Returns the configured PayPal environment (`'sandbox'` or `'production'`).
     */
    getEnvironment(): 'sandbox' | 'production' {
        const raw = (this.options.environment ?? process.env.PAYPAL_ENVIRONMENT ?? 'sandbox')
            .toString()
            .toLowerCase();
        return raw === 'production' ? 'production' : 'sandbox';
    }

    /**
     * Resolves the brand name shown on the PayPal approval screens, if configured.
     */
    getBrandName(): string | undefined {
        return this.options.brandName;
    }

    /**
     * Resolves the default return/cancel URLs for the redirect flow, if configured.
     */
    getRedirectUrls(): { returnUrl?: string; cancelUrl?: string } {
        return { returnUrl: this.options.returnUrl, cancelUrl: this.options.cancelUrl };
    }

    /**
     * Returns the shared {@link OrdersController} instance, creating the underlying client on first
     * use. Throws a descriptive error if the PayPal credentials have not been configured.
     */
    getOrdersController(): OrdersController {
        if (!this.ordersController) {
            this.ordersController = new OrdersController(this.getClient());
        }
        return this.ordersController;
    }

    private getClient(): Client {
        if (this.client) {
            return this.client;
        }
        const clientId = this.options.clientId ?? process.env.PAYPAL_CLIENT_ID;
        const clientSecret = this.options.clientSecret ?? process.env.PAYPAL_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
            throw new Error(
                'PayPal credentials are not configured. Provide `clientId`/`clientSecret` to ' +
                    'PayPalPlugin.init(), or set the PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET ' +
                    'environment variables.',
            );
        }
        const environment = this.getEnvironment();
        this.client = new Client({
            clientCredentialsAuthCredentials: {
                oAuthClientId: clientId,
                oAuthClientSecret: clientSecret,
            },
            environment: environment === 'production' ? Environment.Production : Environment.Sandbox,
            timeout: this.options.timeout ?? 30000,
        });
        Logger.info(`PayPal client initialised (environment: ${environment})`, loggerCtx);
        return this.client;
    }
}
