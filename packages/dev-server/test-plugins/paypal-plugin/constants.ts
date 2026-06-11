/**
 * The context string used for all log output produced by the PayPal plugin.
 */
export const loggerCtx = 'PayPalPlugin';

/**
 * Injection token under which the resolved {@link PayPalPluginOptions} are provided.
 */
export const PAYPAL_PLUGIN_OPTIONS = Symbol('PAYPAL_PLUGIN_OPTIONS');

/**
 * The `code` of the PayPal {@link PaymentMethodHandler}. A Vendure PaymentMethod must be created
 * in the admin which uses this handler in order to accept PayPal payments.
 */
export const PAYPAL_PAYMENT_HANDLER_CODE = 'paypal';
