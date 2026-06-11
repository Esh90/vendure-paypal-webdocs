/**
 * Middleware which adds the raw request body to the incoming message object. This is needed by
 * Stripe to properly verify webhook events.
 */
export declare const rawBodyMiddleware: import("connect").NextHandleFunction;
