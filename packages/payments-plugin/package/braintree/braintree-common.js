"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGateway = getGateway;
exports.defaultExtractMetadataFn = defaultExtractMetadataFn;
const braintree_1 = require("braintree");
function getGateway(args, options) {
    return new braintree_1.BraintreeGateway({
        environment: options.environment || braintree_1.Environment.Sandbox,
        merchantId: args.merchantId,
        privateKey: args.privateKey,
        publicKey: args.publicKey,
    });
}
/**
 * @description
 * Returns a subset of the Transaction object of interest to the Administrator, plus some
 * public data which may be useful to display in the storefront account area.
 */
function defaultExtractMetadataFn(transaction) {
    const metadata = {
        status: transaction.status,
        currencyIsoCode: transaction.currencyIsoCode,
        merchantAccountId: transaction.merchantAccountId,
        cvvCheck: decodeAvsCode(transaction.cvvResponseCode),
        avsPostCodeCheck: decodeAvsCode(transaction.avsPostalCodeResponseCode),
        avsStreetAddressCheck: decodeAvsCode(transaction.avsStreetAddressResponseCode),
        processorAuthorizationCode: transaction.processorAuthorizationCode,
        processorResponseText: transaction.processorResponseText,
        paymentMethod: transaction.paymentInstrumentType,
        public: {},
    };
    if (transaction.creditCard && transaction.creditCard.cardType) {
        const cardData = {
            cardType: transaction.creditCard.cardType,
            last4: transaction.creditCard.last4,
            expirationDate: transaction.creditCard.expirationDate,
        };
        metadata.cardData = cardData;
        metadata.public.cardData = cardData;
    }
    if (transaction.paypalAccount && transaction.paypalAccount.authorizationId) {
        metadata.paypalData = {
            payerEmail: transaction.paypalAccount.payerEmail,
            paymentId: transaction.paypalAccount.paymentId,
            authorizationId: transaction.paypalAccount.authorizationId,
            payerStatus: transaction.paypalAccount.payerStatus,
            sellerProtectionStatus: transaction.paypalAccount.sellerProtectionStatus,
            transactionFeeAmount: transaction.paypalAccount.transactionFeeAmount,
        };
        metadata.public.paypalData = { authorizationId: transaction.paypalAccount.authorizationId };
    }
    return metadata;
}
function decodeAvsCode(code) {
    switch (code) {
        case 'I':
            return 'Not Provided';
        case 'M':
            return 'Matched';
        case 'N':
            return 'Not Matched';
        case 'U':
            return 'Not Verified';
        case 'S':
            return 'Not Supported';
        case 'E':
            return 'AVS System Error';
        case 'A':
            return 'Not Applicable';
        case 'B':
            return 'Skipped';
        default:
            return 'Unknown';
    }
}
//# sourceMappingURL=braintree-common.js.map