"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var BraintreePlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BraintreePlugin = void 0;
const core_1 = require("@vendure/core");
const graphql_tag_1 = require("graphql-tag");
const braintree_handler_1 = require("./braintree.handler");
const braintree_resolver_1 = require("./braintree.resolver");
const constants_1 = require("./constants");
/**
 * @description
 * This plugin enables payments to be processed by [Braintree](https://www.braintreepayments.com/), a popular payment provider.
 *
 * ## Requirements
 *
 * 1. You will need to create a Braintree sandbox account as outlined in https://developers.braintreepayments.com/start/overview.
 * 2. Then install `braintree` and `@types/braintree` from npm. This plugin was written with `v3.x` of the Braintree lib.
 *     ```shell
 *     yarn add \@vendure/payments-plugin braintree
 *     yarn add -D \@types/braintree
 *     ```
 *     or
 *     ```shell
 *     npm install \@vendure/payments-plugin braintree
 *     npm install -D \@types/braintree
 *     ```
 *
 * ## Setup
 *
 * 1. Add the plugin to your VendureConfig `plugins` array:
 *     ```ts
 *     import { BraintreePlugin } from '\@vendure/payments-plugin/package/braintree';
 *     import { Environment } from 'braintree';
 *
 *     // ...
 *
 *     plugins: [
 *       BraintreePlugin.init({
 *         environment: Environment.Sandbox,
 *         // This allows saving customer payment
 *         // methods with Braintree (see "vaulting"
 *         // section below for details)
 *         storeCustomersInBraintree: true,
 *       }),
 *     ]
 *     ```
 * 2. Create a new PaymentMethod in the Admin UI, and select "Braintree payments" as the handler.
 * 2. Fill in the `Merchant ID`, `Public Key` & `Private Key` from your Braintree sandbox account.
 *
 * ## Storefront usage
 *
 * The plugin is designed to work with the [Braintree drop-in UI](https://developers.braintreepayments.com/guides/drop-in/overview/javascript/v3).
 * This is a library provided by Braintree which will handle the payment UI for you. You can install it in your storefront project
 * with:
 *
 * ```shell
 * yarn add braintree-web-drop-in
 * # or
 * npm install braintree-web-drop-in
 * ```
 *
 * The high-level workflow is:
 * 1. Generate a "client token" on the server by executing the `generateBraintreeClientToken` mutation which is exposed by this plugin.
 * 2. Use this client token to instantiate the Braintree Dropin UI.
 * 3. Listen for the `"paymentMethodRequestable"` event which emitted by the Dropin.
 * 4. Use the Dropin's `requestPaymentMethod()` method to get the required payment metadata.
 * 5. Pass that metadata to the `addPaymentToOrder` mutation. The metadata should be an object of type `{ nonce: string; }`
 *
 * Here is an example of how your storefront code will look. Note that this example is attempting to
 * be framework-agnostic, so you'll need to adapt it to fit to your framework of choice.
 *
 * ```ts
 * // The Braintree Dropin instance
 * let dropin: import('braintree-web-drop-in').Dropin;
 *
 * // Used to show/hide a "submit" button, which would be bound to the
 * // `submitPayment()` method below.
 * let showSubmitButton = false;
 *
 * // Used to display a "processing..." spinner
 * let processing = false;
 *
 * //
 * // This method would be invoked when the payment screen is mounted/created.
 * //
 * async function renderDropin(order: Order, clientToken: string) {
 *   // Lazy load braintree dropin because it has a reference
 *   // to `window` which breaks SSR
 *   dropin = await import('braintree-web-drop-in').then((module) =>
 *     module.default.create({
 *       authorization: clientToken,
 *       // This assumes a div in your view with the corresponding ID
 *       container: '#dropin-container',
 *       card: {
 *         cardholderName: {
 *             required: true,
 *         },
 *         overrides: {},
 *       },
 *       // Additional config is passed here depending on
 *       // which payment methods you have enabled in your
 *       // Braintree account.
 *       paypal: {
 *         flow: 'checkout',
 *         amount: order.totalWithTax / 100,
 *         currency: 'GBP',
 *       },
 *     }),
 *   );
 *
 *   // If you are using the `storeCustomersInBraintree` option, then the
 *   // customer might already have a stored payment method selected as
 *   // soon as the dropin script loads. In this case, show the submit
 *   // button immediately.
 *   if (dropin.isPaymentMethodRequestable()) {
 *     showSubmitButton = true;
 *   }
 *
 *   dropin.on('paymentMethodRequestable', (payload) => {
 *     if (payload.type === 'CreditCard') {
 *       showSubmitButton = true;
 *     }
 *     if (payload.type === 'PayPalAccount') {
 *       this.submitPayment();
 *     }
 *   });
 *
 *   dropin.on('noPaymentMethodRequestable', () => {
 *     // Display an error
 *   });
 * }
 *
 * async function generateClientToken() {
 *   const { generateBraintreeClientToken } = await graphQlClient.query(gql`
 *     query GenerateBraintreeClientToken {
 *       generateBraintreeClientToken
 *     }
 *   `);
 *   return generateBraintreeClientToken;
 * }
 *
 * async submitPayment() {
 *   if (!dropin.isPaymentMethodRequestable()) {
 *     return;
 *   }
 *   showSubmitButton = false;
 *   processing = true;
 *
 *   const paymentResult = await dropin.requestPaymentMethod();
 *
 *   const { addPaymentToOrder } = await graphQlClient.query(gql`
 *     mutation AddPayment($input: PaymentInput!) {
 *       addPaymentToOrder(input: $input) {
 *         ... on Order {
 *           id
 *           payments {
 *             id
 *             amount
 *             errorMessage
 *             method
 *             state
 *             transactionId
 *             createdAt
 *           }
 *         }
 *         ... on ErrorResult {
 *           errorCode
 *           message
 *         }
 *       }
 *     }`, {
 *       input: {
 *         method: 'braintree', // The code of you Braintree PaymentMethod
 *         metadata: paymentResult,
 *       },
 *     },
 *   );
 *
 *   switch (addPaymentToOrder?.__typename) {
 *       case 'Order':
 *           // Adding payment succeeded!
 *           break;
 *       case 'OrderStateTransitionError':
 *       case 'OrderPaymentStateError':
 *       case 'PaymentDeclinedError':
 *       case 'PaymentFailedError':
 *         // Display an error to the customer
 *         dropin.clearSelectedPaymentMethod();
 *   }
 * }
 * ```
 *
 * ## Storing payment details (vaulting)
 *
 * Braintree has a [vault feature](https://developer.paypal.com/braintree/articles/control-panel/vault/overview) which allows the secure storage
 * of customer's payment information. Using the vault allows you to offer a faster checkout for repeat customers without needing to worry about
 * how to securely store payment details.
 *
 * To enable this feature, set the `storeCustomersInBraintree` option to `true`.
 *
 * ```ts
 * BraintreePlugin.init({
 *   environment: Environment.Sandbox,
 *   storeCustomersInBraintree: true,
 * }),
 * ```
 *
 * Since v1.8, it is possible to override vaulting on a per-payment basis by passing `includeCustomerId: false` to the `generateBraintreeClientToken`
 * mutation:
 *
 * ```GraphQL
 * const { generateBraintreeClientToken } = await graphQlClient.query(gql`
 *   query GenerateBraintreeClientToken($includeCustomerId: Boolean) {
 *     generateBraintreeClientToken(includeCustomerId: $includeCustomerId)
 *   }
 * `, { includeCustomerId: false });
 * ```
 *
 * as well as in the metadata of the `addPaymentToOrder` mutation:
 *
 * ```ts
 * const { addPaymentToOrder } = await graphQlClient.query(gql`
 *   mutation AddPayment($input: PaymentInput!) {
 *     addPaymentToOrder(input: $input) {
 *       ...Order
 *       ...ErrorResult
 *     }
 *   }`, {
 *     input: {
 *       method: 'braintree',
 *       metadata: {
 *         ...paymentResult,
 *         includeCustomerId: false,
 *       },
 *     }
 *   );
 * ```
 *
 * @docsCategory core plugins/PaymentsPlugin
 * @docsPage BraintreePlugin
 */
let BraintreePlugin = BraintreePlugin_1 = class BraintreePlugin {
    static init(options) {
        this.options = options;
        return BraintreePlugin_1;
    }
};
exports.BraintreePlugin = BraintreePlugin;
BraintreePlugin.options = {};
exports.BraintreePlugin = BraintreePlugin = BraintreePlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        providers: [
            {
                provide: constants_1.BRAINTREE_PLUGIN_OPTIONS,
                useFactory: () => BraintreePlugin.options,
            },
        ],
        configuration: config => {
            config.paymentOptions.paymentMethodHandlers.push(braintree_handler_1.braintreePaymentMethodHandler);
            if (BraintreePlugin.options.storeCustomersInBraintree === true) {
                config.customFields.Customer.push({
                    name: 'braintreeCustomerId',
                    type: 'string',
                    label: [{ languageCode: core_1.LanguageCode.en, value: 'Braintree Customer ID' }],
                    nullable: true,
                    public: false,
                    readonly: true,
                });
            }
            return config;
        },
        shopApiExtensions: {
            schema: (0, graphql_tag_1.gql) `
            extend type Query {
                generateBraintreeClientToken(orderId: ID, includeCustomerId: Boolean): String!
            }
        `,
            resolvers: [braintree_resolver_1.BraintreeResolver],
        },
        compatibility: '^3.0.0',
    })
], BraintreePlugin);
//# sourceMappingURL=braintree.plugin.js.map