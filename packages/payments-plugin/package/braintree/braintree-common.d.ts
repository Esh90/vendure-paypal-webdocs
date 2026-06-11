import { BraintreeGateway, Transaction } from 'braintree';
import { BraintreePluginOptions, PaymentMethodArgsHash } from './types';
export declare function getGateway(args: PaymentMethodArgsHash, options: BraintreePluginOptions): BraintreeGateway;
/**
 * @description
 * Returns a subset of the Transaction object of interest to the Administrator, plus some
 * public data which may be useful to display in the storefront account area.
 */
export declare function defaultExtractMetadataFn(transaction: Transaction): {
    [key: string]: any;
};
