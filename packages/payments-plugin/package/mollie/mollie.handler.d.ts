import { LanguageCode } from '@vendure/common/lib/generated-types';
import { PaymentMethodHandler } from '@vendure/core';
export declare const molliePaymentHandler: PaymentMethodHandler<{
    apiKey: {
        type: "string";
        label: {
            languageCode: LanguageCode.en;
            value: string;
        }[];
    };
    redirectUrl: {
        type: "string";
        required: true;
        defaultValue: string;
        label: {
            languageCode: LanguageCode.en;
            value: string;
        }[];
        description: {
            languageCode: LanguageCode.en;
            value: string;
        }[];
    };
}>;
