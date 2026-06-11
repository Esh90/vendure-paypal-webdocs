"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultPurgeRules = exports.purgeAllOnTaxRateEvent = exports.purgeCollectionsOnCollectionEvent = exports.purgeCollectionsOnCollectionModificationEvent = exports.purgeProductVariantsOnStockMovementEvent = exports.purgeProductVariantsOnChannelEvent = exports.purgeProductsOnChannelEvent = exports.purgeProductVariantsOnProductVariantEvent = exports.purgeProductsOnProductEvent = void 0;
/* eslint-disable @typescript-eslint/no-floating-promises */
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const purge_rule_1 = require("./purge-rule");
exports.purgeProductsOnProductEvent = new purge_rule_1.PurgeRule({
    eventType: core_1.ProductEvent,
    handler: ({ events, stellateService }) => {
        const products = events.map(e => e.product);
        stellateService.purgeProducts(products);
        stellateService.purgeSearchResults(products);
    },
});
exports.purgeProductVariantsOnProductVariantEvent = new purge_rule_1.PurgeRule({
    eventType: core_1.ProductVariantEvent,
    handler: ({ events, stellateService }) => {
        const variants = events.map(e => e.variants).flat();
        stellateService.purgeProductVariants(variants);
        stellateService.purgeSearchResults(variants);
    },
});
exports.purgeProductsOnChannelEvent = new purge_rule_1.PurgeRule({
    eventType: core_1.ProductChannelEvent,
    handler: ({ events, stellateService }) => {
        const products = events.map(e => e.product);
        stellateService.purgeProducts(products);
        stellateService.purgeSearchResults(products);
    },
});
exports.purgeProductVariantsOnChannelEvent = new purge_rule_1.PurgeRule({
    eventType: core_1.ProductVariantChannelEvent,
    handler: ({ events, stellateService }) => {
        const variants = events.map(e => e.productVariant);
        stellateService.purgeProductVariants(variants);
        stellateService.purgeSearchResults(variants);
    },
});
exports.purgeProductVariantsOnStockMovementEvent = new purge_rule_1.PurgeRule({
    eventType: core_1.StockMovementEvent,
    handler: ({ events, stellateService }) => {
        const variants = events.map(e => e.stockMovements.map(m => m.productVariant)).flat();
        stellateService.purgeProductVariants(variants);
        stellateService.purgeSearchResults(variants);
    },
});
exports.purgeCollectionsOnCollectionModificationEvent = new purge_rule_1.PurgeRule({
    eventType: core_1.CollectionModificationEvent,
    handler: ({ events, stellateService }) => {
        const collectionsToPurge = events.filter(e => e.productVariantIds.length).map(e => e.collection);
        core_1.Logger.debug(`purgeCollectionsOnCollectionModificationEvent, collectionsToPurge: ${collectionsToPurge
            .map(c => c.id)
            .join(', ')}`, constants_1.loggerCtx);
        if (collectionsToPurge.length) {
            stellateService.purgeCollections(collectionsToPurge);
            stellateService.purgeSearchResponseCacheIdentifiers(collectionsToPurge);
        }
    },
});
exports.purgeCollectionsOnCollectionEvent = new purge_rule_1.PurgeRule({
    eventType: core_1.CollectionEvent,
    handler: ({ events, stellateService }) => {
        const collections = events.map(e => e.entity);
        stellateService.purgeCollections(collections);
    },
});
exports.purgeAllOnTaxRateEvent = new purge_rule_1.PurgeRule({
    eventType: core_1.TaxRateEvent,
    handler: ({ stellateService }) => {
        stellateService.purgeAllOfType('ProductVariant');
        stellateService.purgeAllOfType('Product');
        stellateService.purgeAllOfType('SearchResponse');
    },
});
exports.defaultPurgeRules = [
    exports.purgeAllOnTaxRateEvent,
    exports.purgeCollectionsOnCollectionEvent,
    exports.purgeCollectionsOnCollectionModificationEvent,
    exports.purgeProductsOnChannelEvent,
    exports.purgeProductsOnProductEvent,
    exports.purgeProductVariantsOnChannelEvent,
    exports.purgeProductVariantsOnProductVariantEvent,
    exports.purgeProductVariantsOnStockMovementEvent,
];
//# sourceMappingURL=default-purge-rules.js.map