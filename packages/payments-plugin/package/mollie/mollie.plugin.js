"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var MolliePlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MolliePlugin = void 0;
const core_1 = require("@vendure/core");
const api_extensions_1 = require("./api-extensions");
const constants_1 = require("./constants");
const mollie_common_resolver_1 = require("./mollie.common-resolver");
const mollie_controller_1 = require("./mollie.controller");
const mollie_handler_1 = require("./mollie.handler");
const mollie_service_1 = require("./mollie.service");
const mollie_shop_resolver_1 = require("./mollie.shop-resolver");
/**
 * @description
 * Plugin to enable payments through the [Mollie platform](https://docs.mollie.com/).
 * This plugin uses the Order API from Mollie, not the Payments API.
 *
 * ## Requirements
 *
 * 1. You will need to create a Mollie account and get your apiKey in the dashboard.
 * 2. Install the Payments plugin and the Mollie client:
 *
 *     `yarn add \@vendure/payments-plugin \@mollie/api-client`
 *
 *     or
 *
 *     `npm install \@vendure/payments-plugin \@mollie/api-client`
 *
 * ## Setup
 *
 * 1. Add the plugin to your VendureConfig `plugins` array:
 *     ```ts
 *     import { MolliePlugin } from '\@vendure/payments-plugin/package/mollie';
 *
 *     // ...
 *
 *     plugins: [
 *       MolliePlugin.init({ vendureHost: 'https://yourhost.io/' }),
 *     ]
 *     ```
 * 2. Create a new PaymentMethod in the Admin UI, and select "Mollie payments" as the handler.
 * 3. Set your Mollie apiKey in the `API Key` field.
 * 4. Set the `Fallback redirectUrl` to the url that the customer should be redirected to after completing the payment.
 * You can override this url by passing the `redirectUrl` as an argument to the `createMolliePaymentIntent` mutation.
 *
 * ## Storefront usage
 *
 * In your storefront you add a payment to an order using the `createMolliePaymentIntent` mutation. In this example, our Mollie
 * PaymentMethod was given the code "mollie-payment-method". The `redirectUrl``is the url that is used to redirect the end-user
 * back to your storefront after completing the payment.
 *
 * ```GraphQL
 * mutation CreateMolliePaymentIntent {
 *   createMolliePaymentIntent(input: {
 *     redirectUrl: "https://storefront/order/1234XYZ" // Optional, the fallback redirect url set in the admin UI will be used if not provided
 *     paymentMethodCode: "mollie-payment-method" // Optional, the first method with Mollie as handler will be used if not provided
 *     molliePaymentMethodCode: "ideal", // Optional argument to skip the method selection in the hosted checkout
 *     locale: "nl_NL", // Optional, the browser language will be used by Mollie if not provided
 *     immediateCapture: true, // Optional, default is true, set to false if you expect the order fulfillment to take longer than 24 hours
 *   }) {
 *          ... on MolliePaymentIntent {
 *               url
 *           }
 *          ... on MolliePaymentIntentError {
 *               errorCode
 *               message
 *          }
 *   }
 * }
 * ```
 *
 * The response will contain
 * a redirectUrl, which can be used to redirect your customer to the Mollie
 * platform.
 *
 * 'molliePaymentMethodCode' is an optional parameter that can be passed to skip Mollie's hosted payment method selection screen
 * You can get available Mollie payment methods with the following query:
 *
 * ```GraphQL
 * {
 *  molliePaymentMethods(input: { paymentMethodCode: "mollie-payment-method" }) {
 *    id
 *    code
 *    description
 *    minimumAmount {
 *      value
 *      currency
 *    }
 *    maximumAmount {
 *      value
 *      currency
 *    }
 *    image {
 *      size1x
 *      size2x
 *      svg
 *    }
 *  }
 * }
 * ```
 *
 * After completing payment on the Mollie platform,
 * the user is redirected to the redirect url that was provided in the `createMolliePaymentIntent` mutation, e.g. `https://storefront/order/CH234X5`
 *
 * ## Pay later methods
 *
 * Mollie supports pay-later methods like 'Klarna Pay Later'. Pay-later methods are captured immediately after payment.
 *
 * If your order fulfillment time is longer than 24 hours You should pass `immediateCapture=false` to the `createMolliePaymentIntent` mutation.
 * This will transition your order to 'PaymentAuthorized' after the Mollie hosted checkout.
 * You need to manually capture the payment after the order is fulfilled, by settling existing payments, either via the admin UI or in custom code.
 *
 * Make sure to capture a payment within 28 days, after that the payment will be automaticallreleased.
 * See the [Mollie documentation](https://docs.mollie.com/docs/place-a-hold-for-a-payment#authorization-expiration-window)
 * for more information.
 *
 * ## ArrangingAdditionalPayment state
 *
 * In some rare cases, a customer can add items to the active order, while a Mollie checkout is still open,
 * for example by opening your storefront in another browser tab.
 * This could result in an order being in `ArrangingAdditionalPayment` status after the customer finished payment.
 * You should check if there is still an active order with status `ArrangingAdditionalPayment` on your order confirmation page,
 * and if so, allow your customer to pay for the additional items by creating another Mollie payment.
 *
 * @docsCategory core plugins/PaymentsPlugin
 * @docsPage MolliePlugin
 * @docsWeight 0
 */
let MolliePlugin = MolliePlugin_1 = class MolliePlugin {
    /**
     * @description
     * Initialize the mollie payment plugin
     * @param vendureHost is needed to pass to mollie for callback
     */
    static init(options) {
        this.options = options;
        return MolliePlugin_1;
    }
};
exports.MolliePlugin = MolliePlugin;
exports.MolliePlugin = MolliePlugin = MolliePlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        controllers: [mollie_controller_1.MollieController],
        providers: [mollie_service_1.MollieService, { provide: constants_1.PLUGIN_INIT_OPTIONS, useFactory: () => MolliePlugin.options }],
        configuration: (config) => {
            config.paymentOptions.paymentMethodHandlers.push(mollie_handler_1.molliePaymentHandler);
            return config;
        },
        shopApiExtensions: {
            schema: api_extensions_1.shopApiExtensions,
            resolvers: [mollie_common_resolver_1.MollieCommonResolver, mollie_shop_resolver_1.MollieShopResolver],
        },
        adminApiExtensions: {
            schema: api_extensions_1.adminApiExtensions,
            resolvers: [mollie_common_resolver_1.MollieCommonResolver],
        },
        compatibility: '^3.0.0',
    })
], MolliePlugin);
//# sourceMappingURL=mollie.plugin.js.map