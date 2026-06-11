"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultOptions = void 0;
exports.mergeWithDefaults = mergeWithDefaults;
const deepmerge_1 = __importDefault(require("deepmerge"));
exports.defaultOptions = {
    host: 'http://localhost',
    port: 9200,
    connectionAttempts: 10,
    connectionAttemptInterval: 5000,
    indexPrefix: 'vendure-',
    indexSettings: {},
    indexMappingProperties: {},
    reindexProductsChunkSize: 2500,
    reindexBulkOperationSizeLimit: 3000,
    searchConfig: {
        facetValueMaxSize: 50,
        collectionMaxSize: 50,
        totalItemsMaxSize: 10000,
        multiMatchType: 'best_fields',
        boostFields: {
            productName: 5,
            productVariantName: 5,
            description: 1,
            sku: 1,
        },
        priceRangeBucketInterval: 1000,
        mapQuery: query => query,
        mapSort: sort => sort,
        scriptFields: {},
    },
    customProductMappings: {},
    customProductVariantMappings: {},
    bufferUpdates: false,
    hydrateProductRelations: [],
    hydrateProductVariantRelations: [],
    extendSearchInputType: {},
    extendSearchSortType: [],
};
function mergeWithDefaults(userOptions) {
    const { clientOptions } = userOptions, pluginOptions = __rest(userOptions, ["clientOptions"]);
    const merged = (0, deepmerge_1.default)(exports.defaultOptions, pluginOptions);
    return Object.assign(Object.assign({}, merged), { clientOptions });
}
//# sourceMappingURL=options.js.map