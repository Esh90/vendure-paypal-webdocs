import { CreateParameters } from '@mollie/api-client/dist/types/binders/payments/parameters';
import { Amount, Address as MollieAddress } from '@mollie/api-client/dist/types/data/global';
import { Customer, Order } from '@vendure/core';
import { OrderAddress } from './graphql/generated-shop-types';
/**
 * Check if given address has mandatory fields for Mollie and map to a MollieAddress.
 * Returns undefined if address doesn't have all mandatory fields
 */
export declare function toMollieAddress(address: OrderAddress, customer: Customer): MollieAddress | undefined;
/**
 * Map all order and shipping lines to a single array of Mollie payment lines
 */
export declare function toMolliePaymentLines(order: Order, alreadyPaid: number): CreateParameters['lines'];
/**
 * Stringify and fixed decimals
 */
export declare function toAmount(value: number, orderCurrency: string): Amount;
/**
 * Return to number of cents. E.g. '10.00' => 1000
 */
export declare function amountToCents(amount: Amount): number;
/**
 * Recalculate tax amount per order line instead of per unit for Mollie.
 * Vendure calculates tax per unit, but Mollie expects the tax to be calculated per order line (the total of the quantities).
 * See https://github.com/vendure-ecommerce/vendure/issues/1939#issuecomment-1362962133 for more information on the rounding issue.
 */
export declare function calculateLineTaxAmount(taxRate: number, orderLinePriceWithTax: number): number;
