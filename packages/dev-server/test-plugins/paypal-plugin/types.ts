/**
 * @description
 * Configuration options for the {@link PayPalPlugin}.
 *
 * Credentials and environment are resolved at runtime: any value supplied here takes precedence,
 * otherwise the plugin falls back to the `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` and
 * `PAYPAL_ENVIRONMENT` environment variables. This mirrors PayPal's recommended server-to-server
 * OAuth 2.0 Client Credentials flow, where the access token is managed and refreshed automatically
 * by the SDK.
 */
export interface PayPalPluginOptions {
    /**
     * PayPal REST app Client ID. Defaults to `process.env.PAYPAL_CLIENT_ID`.
     */
    clientId?: string;
    /**
     * PayPal REST app Client Secret. Defaults to `process.env.PAYPAL_CLIENT_SECRET`.
     */
    clientSecret?: string;
    /**
     * The PayPal environment to target. Defaults to `process.env.PAYPAL_ENVIRONMENT` and finally
     * to `'sandbox'` when nothing is configured.
     */
    environment?: 'sandbox' | 'production';
    /**
     * Optional brand name shown to the buyer on the PayPal approval screens.
     */
    brandName?: string;
    /**
     * Optional default URL the buyer is redirected to after approving the payment on PayPal
     * (redirect flow). The storefront may override this per-request.
     */
    returnUrl?: string;
    /**
     * Optional default URL the buyer is redirected to after cancelling the payment on PayPal
     * (redirect flow). The storefront may override this per-request.
     */
    cancelUrl?: string;
    /**
     * Request timeout in milliseconds for calls to the PayPal API. Defaults to `30000`.
     */
    timeout?: number;
}

/**
 * @description
 * The shape of the metadata stored on a Vendure {@link Payment} created by the PayPal handler.
 * These identifiers are required by the downstream settle/void/refund operations.
 */
export interface PayPalPaymentMetadata {
    /** The PayPal order ID (the `id` returned by `createOrder`). */
    paypalOrderId: string;
    /** The intent the PayPal order was created with. */
    intent?: 'CAPTURE' | 'AUTHORIZE';
    /** The PayPal authorization ID, present for the authorize-then-capture flow before capture. */
    authorizationId?: string;
    /** The PayPal capture ID, present once funds have been captured. */
    captureId?: string;
    /** The PayPal order/authorization/capture status at the time the payment was created/settled. */
    status?: string;
}
