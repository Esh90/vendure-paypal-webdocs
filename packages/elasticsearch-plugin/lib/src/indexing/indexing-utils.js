"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIndices = createIndices;
exports.deleteIndices = deleteIndices;
exports.deleteByChannel = deleteByChannel;
exports.getClient = getClient;
exports.getIndexNameByAlias = getIndexNameByAlias;
const elasticsearch_1 = require("@elastic/elasticsearch");
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
async function createIndices(client, prefix, indexSettings, indexMappingProperties, mapAlias = true, aliasPostfix = '') {
    const textWithKeyword = {
        type: 'text',
        fields: {
            keyword: {
                type: 'keyword',
                ignore_above: 256,
            },
        },
    };
    const keyword = { type: 'keyword' };
    const variantMappings = Object.assign({ sku: textWithKeyword, slug: textWithKeyword, productId: keyword, channelId: keyword, languageCode: keyword, productName: textWithKeyword, productVariantId: keyword, productVariantName: textWithKeyword, currencyCode: keyword, description: textWithKeyword, facetIds: keyword, facetValueIds: keyword, collectionIds: keyword, collectionSlugs: keyword, channelIds: keyword, enabled: { type: 'boolean' }, productEnabled: { type: 'boolean' }, productAssetId: keyword, productPreview: textWithKeyword, productPreviewFocalPoint: { type: 'object' }, productVariantAssetId: keyword, productVariantPreview: textWithKeyword, productVariantPreviewFocalPoint: { type: 'object' }, productChannelIds: keyword, productCollectionIds: keyword, productCollectionSlugs: keyword, productFacetIds: keyword, productFacetValueIds: keyword, productPriceMax: { type: 'long' }, productPriceMin: { type: 'long' }, productPriceWithTaxMax: { type: 'long' }, productPriceWithTaxMin: { type: 'long' }, price: { type: 'long' }, priceWithTax: { type: 'long' }, inStock: { type: 'boolean' }, productInStock: { type: 'boolean' } }, indexMappingProperties);
    const unixtimestampPostfix = new Date().getTime();
    const createIndex = async (mappings, index, alias) => {
        if (mapAlias) {
            await client.indices.create({
                index,
                body: {
                    mappings: {
                        properties: mappings,
                    },
                    settings: indexSettings,
                },
            });
            await client.indices.putAlias({
                index,
                name: alias,
            });
            core_1.Logger.verbose(`Created index "${index}"`, constants_1.loggerCtx);
        }
        else {
            await client.indices.create({
                index: alias,
                body: {
                    mappings: {
                        properties: mappings,
                    },
                    settings: indexSettings,
                },
            });
            core_1.Logger.verbose(`Created index "${alias}"`, constants_1.loggerCtx);
        }
    };
    try {
        const index = prefix + constants_1.VARIANT_INDEX_NAME + `${unixtimestampPostfix}`;
        const alias = prefix + constants_1.VARIANT_INDEX_NAME + aliasPostfix;
        await createIndex(variantMappings, index, alias);
    }
    catch (e) {
        core_1.Logger.error(JSON.stringify(e, null, 2), constants_1.loggerCtx);
    }
}
async function deleteIndices(client, prefix) {
    try {
        const index = await getIndexNameByAlias(client, prefix + constants_1.VARIANT_INDEX_NAME);
        await client.indices.delete({ index });
        core_1.Logger.verbose(`Deleted index "${index}"`, constants_1.loggerCtx);
    }
    catch (e) {
        core_1.Logger.error(e, constants_1.loggerCtx);
    }
}
async function deleteByChannel(client, prefix, channelId) {
    try {
        const index = prefix + constants_1.VARIANT_INDEX_NAME;
        await client.deleteByQuery({
            index,
            body: {
                query: {
                    match: { channelId },
                },
            },
        });
        core_1.Logger.verbose(`Deleted index "${index} for channel "${channelId}"`, constants_1.loggerCtx);
    }
    catch (e) {
        core_1.Logger.error(e, constants_1.loggerCtx);
    }
}
function getClient(options) {
    var _a, _b;
    const { host, port } = options;
    const node = (_b = (_a = options.clientOptions) === null || _a === void 0 ? void 0 : _a.node) !== null && _b !== void 0 ? _b : `${host}:${port}`;
    return new elasticsearch_1.Client(Object.assign({ node }, options.clientOptions));
}
async function getIndexNameByAlias(client, aliasName) {
    const aliasExist = await client.indices.existsAlias({ name: aliasName });
    if (aliasExist.body) {
        const alias = await client.indices.getAlias({
            name: aliasName,
        });
        return Object.keys(alias.body)[0];
    }
    else {
        return aliasName;
    }
}
//# sourceMappingURL=indexing-utils.js.map