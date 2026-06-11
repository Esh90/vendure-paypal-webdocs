import { Logger } from '@vendure/core';
import { ApiError } from '@paypal/paypal-server-sdk';

/**
 * Extracts a human-readable description from a PayPal error response. PayPal returns the error
 * envelope (`name`, `message`, `details[].issue`/`description`, `debug_id`) either as the parsed
 * `result` or, when it does not match the endpoint's success schema, as the raw JSON `body` string —
 * both are handled here.
 */
export function describePayPalError(e: ApiError): string | undefined {
    let envelope: any = e.result;
    if ((!envelope || typeof envelope !== 'object') && typeof e.body === 'string') {
        try {
            envelope = JSON.parse(e.body);
        } catch {
            return undefined;
        }
    }
    if (!envelope || typeof envelope !== 'object') {
        return undefined;
    }
    const parts: string[] = [];
    if (Array.isArray(envelope.details) && envelope.details.length > 0) {
        for (const detail of envelope.details) {
            if (detail && typeof detail === 'object') {
                const issue = typeof detail.issue === 'string' ? detail.issue : '';
                const description = typeof detail.description === 'string' ? detail.description : '';
                const combined = [issue, description].filter(Boolean).join(': ');
                if (combined) {
                    parts.push(combined);
                }
            }
        }
    } else if (typeof envelope.message === 'string') {
        parts.push(envelope.message);
    }
    if (typeof envelope.debug_id === 'string') {
        parts.push(`debug_id=${envelope.debug_id}`);
    }
    return parts.length > 0 ? parts.join(' | ') : undefined;
}

/**
 * Normalises errors thrown by the PayPal SDK into a single, logged Error with a clear message.
 * PayPal {@link ApiError}s carry an HTTP status code and a structured error body; we surface the
 * specific issue (e.g. `REFUND_FAILED_INSUFFICIENT_FUNDS`) to the caller and write the full body to
 * the log for troubleshooting.
 */
export function toReadablePayPalError(e: unknown, action: string, loggerCtx: string): Error {
    if (e instanceof ApiError) {
        const rawBody = typeof e.body === 'string' ? e.body : JSON.stringify(e.result);
        Logger.error(
            `PayPal API error while attempting to ${action} (status ${e.statusCode}): ${e.message} | ${rawBody}`,
            loggerCtx,
        );
        const detail = describePayPalError(e);
        return new Error(
            `Failed to ${action}: PayPal responded with status ${e.statusCode}` +
                (detail ? ` — ${detail}` : ''),
        );
    }
    const message = e instanceof Error ? e.message : String(e);
    Logger.error(`Failed to ${action}: ${message}`, loggerCtx);
    return e instanceof Error ? e : new Error(message);
}

/**
 * Safely extracts a top-level string field from a PayPal response `body`. Used to read fields that
 * the SDK's typed model does not expose (notably `Subscription.status`, which the generated schema
 * strips because it is not a mapped property).
 */
export function readBodyField(
    body: string | Blob | NodeJS.ReadableStream | undefined,
    field: string,
): string | undefined {
    if (typeof body !== 'string') {
        return undefined;
    }
    try {
        const parsed = JSON.parse(body);
        const value = parsed?.[field];
        return typeof value === 'string' ? value : undefined;
    } catch {
        return undefined;
    }
}
