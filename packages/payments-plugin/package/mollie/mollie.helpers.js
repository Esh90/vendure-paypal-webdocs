"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toMollieAddress = toMollieAddress;
exports.toMolliePaymentLines = toMolliePaymentLines;
exports.toAmount = toAmount;
exports.amountToCents = amountToCents;
exports.calculateLineTaxAmount = calculateLineTaxAmount;
const currency_js_1 = __importDefault(require("currency.js"));
/**
 * Check if given address has mandatory fields for Mollie and map to a MollieAddress.
 * Returns undefined if address doesn't have all mandatory fields
 */
function toMollieAddress(address, customer) {
    if (address.city && address.countryCode && address.streetLine1 && address.postalCode) {
        return {
            streetAndNumber: `${address.streetLine1} ${address.streetLine2 || ''}`,
            postalCode: address.postalCode,
            city: address.city,
            country: address.countryCode.toUpperCase(),
            givenName: customer.firstName,
            familyName: customer.lastName,
            email: customer.emailAddress,
        };
    }
}
/**
 * Map all order and shipping lines to a single array of Mollie payment lines
 */
function toMolliePaymentLines(order, alreadyPaid) {
    // Add lines
    const lines = order.lines.map(line => ({
        description: line.productVariant.name,
        quantity: line.quantity,
        unitPrice: toAmount(line.proratedLinePriceWithTax / line.quantity, order.currencyCode), // totalAmount has to match unitPrice * quantity
        totalAmount: toAmount(line.proratedLinePriceWithTax, order.currencyCode),
        vatRate: line.taxRate.toFixed(2),
        vatAmount: toAmount(calculateLineTaxAmount(line.taxRate, line.proratedLinePriceWithTax), order.currencyCode),
    }));
    // Add shippingLines
    lines.push(...order.shippingLines.map(line => {
        var _a;
        return ({
            description: ((_a = line.shippingMethod) === null || _a === void 0 ? void 0 : _a.name) || 'Shipping',
            quantity: 1,
            unitPrice: toAmount(line.discountedPriceWithTax, order.currencyCode),
            totalAmount: toAmount(line.discountedPriceWithTax, order.currencyCode),
            vatRate: String(line.taxRate),
            vatAmount: toAmount(line.discountedPriceWithTax - line.discountedPrice, order.currencyCode),
        });
    }));
    // Add surcharges
    lines.push(...order.surcharges.map(surcharge => ({
        description: surcharge.description,
        quantity: 1,
        unitPrice: toAmount(surcharge.priceWithTax, order.currencyCode),
        totalAmount: toAmount(surcharge.priceWithTax, order.currencyCode),
        vatRate: String(surcharge.taxRate),
        vatAmount: toAmount(surcharge.priceWithTax - surcharge.price, order.currencyCode),
        type: surcharge.priceWithTax < 0 ? 'store_credit' : undefined,
    })));
    // Deduct amount already paid
    if (alreadyPaid) {
        lines.push({
            description: 'Already paid',
            quantity: 1,
            unitPrice: toAmount(-alreadyPaid, order.currencyCode),
            totalAmount: toAmount(-alreadyPaid, order.currencyCode),
            vatRate: String(0),
            vatAmount: toAmount(0, order.currencyCode),
            type: 'store_credit', // Needed to allow negative unitPrice
        });
    }
    return lines;
}
/**
 * Stringify and fixed decimals
 */
function toAmount(value, orderCurrency) {
    return {
        value: (value / 100).toFixed(2),
        currency: orderCurrency,
    };
}
/**
 * Return to number of cents. E.g. '10.00' => 1000
 */
function amountToCents(amount) {
    return (0, currency_js_1.default)(amount.value).intValue;
}
/**
 * Recalculate tax amount per order line instead of per unit for Mollie.
 * Vendure calculates tax per unit, but Mollie expects the tax to be calculated per order line (the total of the quantities).
 * See https://github.com/vendure-ecommerce/vendure/issues/1939#issuecomment-1362962133 for more information on the rounding issue.
 */
function calculateLineTaxAmount(taxRate, orderLinePriceWithTax) {
    const taxMultiplier = taxRate / 100;
    return orderLinePriceWithTax * (taxMultiplier / (1 + taxMultiplier)); // I.E. €99,99 * (0,2 ÷ 1,2) with a 20% taxrate
}
//# sourceMappingURL=mollie.helpers.js.map