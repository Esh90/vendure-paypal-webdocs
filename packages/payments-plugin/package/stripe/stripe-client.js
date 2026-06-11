"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendureStripeClient = void 0;
const stripe_1 = __importDefault(require("stripe"));
/**
 * Wrapper around the Stripe client that exposes ApiKey and WebhookSecret
 */
class VendureStripeClient extends stripe_1.default {
    constructor(apiKey, webhookSecret) {
        super(apiKey, {
            apiVersion: null, // Use accounts default version
        });
        this.apiKey = apiKey;
        this.webhookSecret = webhookSecret;
    }
}
exports.VendureStripeClient = VendureStripeClient;
//# sourceMappingURL=stripe-client.js.map