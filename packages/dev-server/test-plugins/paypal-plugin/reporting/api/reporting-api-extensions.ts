import gql from 'graphql-tag';

/**
 * Admin API extensions for PayPal transaction & balance reporting (Use Case 7). Data is fetched
 * live from PayPal for reconciliation; there are no Vendure entities behind these queries.
 */
export const reportingApiExtensions = gql`
    type PayPalMoney {
        currencyCode: String!
        value: String!
    }

    type PayPalReportTransaction {
        transactionId: String
        status: String
        eventCode: String
        initiationDate: String
        updatedDate: String
        amount: PayPalMoney
        feeAmount: PayPalMoney
        payerEmail: String
        payerName: String
    }

    type PayPalTransactionReport {
        startDate: String!
        endDate: String!
        totalCount: Int!
        "True when the requested range exceeded the supported window cap and was truncated."
        truncated: Boolean!
        transactions: [PayPalReportTransaction!]!
    }

    type PayPalBalance {
        currencyCode: String
        primary: Boolean
        availableBalance: PayPalMoney
        withheldBalance: PayPalMoney
    }

    type PayPalBalancesReport {
        asOfTime: String
        lastRefreshTime: String
        balances: [PayPalBalance!]!
    }

    input PayPalTransactionSearchInput {
        startDate: String!
        endDate: String!
        transactionId: String
        transactionStatus: String
        pageSize: Int
    }

    extend type Query {
        payPalTransactions(input: PayPalTransactionSearchInput!): PayPalTransactionReport!
        payPalBalances(asOfTime: String, currencyCode: String): PayPalBalancesReport!
    }
`;
