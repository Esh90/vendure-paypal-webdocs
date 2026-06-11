import Stripe from 'stripe';
/**
 * @description
 * Santitize metadata to ensure it follow Stripe's instructions
 *
 * @link
 * https://stripe.com/docs/api/metadata
 *
 * @Restriction
 * You can specify up to 50 keys, with key names up to 40 characters long and values up to 500 characters long.
 *
 */
export declare function sanitizeMetadata(metadata: Stripe.MetadataParam): Stripe.MetadataParam;
