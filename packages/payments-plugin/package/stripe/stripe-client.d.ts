import Stripe from 'stripe';
/**
 * Wrapper around the Stripe client that exposes ApiKey and WebhookSecret
 */
export declare class VendureStripeClient extends Stripe {
    private apiKey;
    webhookSecret: string;
    constructor(apiKey: string, webhookSecret: string);
}
