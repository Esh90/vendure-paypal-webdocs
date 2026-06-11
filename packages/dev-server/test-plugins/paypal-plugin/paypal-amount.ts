/**
 * Helpers for converting between Vendure's integer minor-unit amounts (e.g. `1000` = $10.00) and
 * the decimal string amounts expected by the PayPal REST API (e.g. `"10.00"`).
 *
 * The number of decimal places is currency-dependent (most currencies use 2, `JPY` uses 0, some
 * use 3), so we derive it from the runtime `Intl` data rather than hard-coding it.
 */

/**
 * Returns the number of decimal places used by the given ISO-4217 currency code.
 * Falls back to `2` if the currency is not recognised by the runtime.
 */
export function getCurrencyDecimals(currencyCode: string): number {
    try {
        const resolved = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currencyCode,
        }).resolvedOptions();
        return resolved.maximumFractionDigits ?? 2;
    } catch {
        return 2;
    }
}

/**
 * Converts an integer minor-unit amount into the decimal string PayPal expects for the given
 * currency, e.g. `toPayPalAmount(1000, 'USD') === '10.00'`.
 */
export function toPayPalAmount(minorUnits: number, currencyCode: string): string {
    const decimals = getCurrencyDecimals(currencyCode);
    const divisor = Math.pow(10, decimals);
    return (minorUnits / divisor).toFixed(decimals);
}

/**
 * Converts a PayPal decimal string amount back into Vendure's integer minor units for the given
 * currency, e.g. `fromPayPalAmount('10.00', 'USD') === 1000`. Used to verify that the amount
 * captured by PayPal matches the amount expected by Vendure.
 */
export function fromPayPalAmount(value: string, currencyCode: string): number {
    const decimals = getCurrencyDecimals(currencyCode);
    const multiplier = Math.pow(10, decimals);
    return Math.round(Number(value) * multiplier);
}
