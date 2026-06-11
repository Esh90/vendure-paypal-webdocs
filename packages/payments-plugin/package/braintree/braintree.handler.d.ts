import { LanguageCode } from '@vendure/common/lib/generated-types';
import { PaymentMethodHandler } from '@vendure/core';
/**
 * The handler for Braintree payments.
 */
export declare const braintreePaymentMethodHandler: PaymentMethodHandler<{
    merchantId: {
        type: "string";
        label: {
            languageCode: LanguageCode.en;
            value: string;
        }[];
    };
    publicKey: {
        type: "string";
        label: {
            languageCode: LanguageCode.en;
            value: string;
        }[];
    };
    privateKey: {
        type: "string";
        label: {
            languageCode: LanguageCode.en;
            value: string;
        }[];
    };
}>;
