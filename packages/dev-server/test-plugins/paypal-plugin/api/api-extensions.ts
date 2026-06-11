import gql from 'graphql-tag';

/**
 * Shop API extensions for the PayPal standard checkout flow.
 *
 * `createPayPalCheckout` creates a PayPal order (intent `CAPTURE`) for the buyer's active order and
 * returns the approval URL. After the buyer approves the payment on PayPal, the storefront calls
 * the standard `addPaymentToOrder` mutation, passing the returned `id` as `metadata.paypalOrderId`.
 */
export const shopApiExtensions = gql`
    """
    The PayPal payment intent. CAPTURE captures funds immediately (standard checkout); AUTHORIZE
    only reserves the funds, which are captured later when the Vendure payment is settled.
    """
    enum PayPalOrderIntent {
        CAPTURE
        AUTHORIZE
    }

    type PayPalCheckout {
        id: String!
        status: String!
        approveUrl: String
    }

    input CreatePayPalCheckoutInput {
        orderId: ID
        intent: PayPalOrderIntent
        returnUrl: String
        cancelUrl: String
    }

    extend type Mutation {
        createPayPalCheckout(input: CreatePayPalCheckoutInput): PayPalCheckout!
    }
`;
