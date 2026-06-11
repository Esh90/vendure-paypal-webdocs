import gql from 'graphql-tag';

/**
 * Admin API extensions for managing PayPal billing plans and subscriptions (Use Case 6).
 */
export const adminSubscriptionApiExtensions = gql`
    enum PayPalIntervalUnit {
        DAY
        WEEK
        MONTH
        YEAR
    }

    type PayPalBillingPlan {
        id: String!
        name: String
        status: String!
    }

    type PayPalSubscriptionInfo {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        paypalSubscriptionId: String!
        planId: String!
        status: String!
        subscriberEmail: String
        customId: String
        startTime: String
    }

    input CreatePayPalBillingPlanInput {
        productId: String!
        name: String!
        description: String
        intervalUnit: PayPalIntervalUnit!
        intervalCount: Int
        price: Money!
        currencyCode: String!
        totalCycles: Int
        paymentFailureThreshold: Int
        autoBillOutstanding: Boolean
        activate: Boolean
    }

    extend type Query {
        payPalBillingPlans(productId: String): [PayPalBillingPlan!]!
        payPalSubscriptions: [PayPalSubscriptionInfo!]!
    }

    extend type Mutation {
        createPayPalBillingPlan(input: CreatePayPalBillingPlanInput!): PayPalBillingPlan!
        activatePayPalBillingPlan(planId: String!): Boolean!
        deactivatePayPalBillingPlan(planId: String!): Boolean!
        updatePayPalBillingPlanPricing(planId: String!, price: Money!, currencyCode: String!): Boolean!
        updatePayPalBillingPlanFailureThreshold(planId: String!, threshold: Int!): Boolean!
        cancelPayPalSubscription(paypalSubscriptionId: String!, reason: String!): Boolean!
        capturePayPalSubscription(
            paypalSubscriptionId: String!
            amount: Money!
            currencyCode: String!
        ): String
        syncPayPalSubscription(paypalSubscriptionId: String!): String!
    }
`;

/**
 * Shop API extensions allowing a customer to subscribe to a billing plan (Use Case 6).
 */
export const shopSubscriptionApiExtensions = gql`
    type PayPalSubscriptionResult {
        id: String!
        status: String!
        approveUrl: String
    }

    input CreatePayPalSubscriptionInput {
        planId: String!
        subscriberEmail: String
        customId: String
        startTime: String
    }

    extend type Mutation {
        createPayPalSubscription(input: CreatePayPalSubscriptionInput!): PayPalSubscriptionResult!
    }
`;
