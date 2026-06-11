import gql from 'graphql-tag';

/**
 * Shop API extensions for the PayPal standard checkout flow.
 *
 * `createPayPalCheckout` creates a PayPal order (intent `CAPTURE`) for the buyer's active order and
 * returns the approval URL. After the buyer approves the payment on PayPal, the storefront calls
 * the standard `addPaymentToOrder` mutation, passing the returned `id` as `metadata.paypalOrderId`.
 */
export const shopApiExtensions = gql`
    type PayPalCheckout {
        id: String!
        status: String!
        approveUrl: String
    }

    input CreatePayPalCheckoutInput {
        orderId: ID
        returnUrl: String
        cancelUrl: String
    }

    extend type Mutation {
        createPayPalCheckout(input: CreatePayPalCheckoutInput): PayPalCheckout!
    }
`;
