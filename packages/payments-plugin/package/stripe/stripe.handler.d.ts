import { LanguageCode, PaymentMethodHandler } from '@vendure/core';
/**
 * The handler for Stripe payments.
 */
export declare const stripePaymentMethodHandler: PaymentMethodHandler<{
    apiKey: {
        type: "string";
        label: {
            languageCode: LanguageCode.en;
            value: string;
        }[];
        ui: {
            component: string;
        };
    };
    webhookSecret: {
        type: "string";
        label: {
            languageCode: LanguageCode.en;
            value: string;
        }[];
        description: {
            languageCode: LanguageCode.en;
            value: string;
        }[];
        ui: {
            component: string;
        };
    };
}>;
