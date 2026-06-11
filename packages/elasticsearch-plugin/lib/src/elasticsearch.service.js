"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var ElasticsearchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElasticsearchService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const es6_1 = __importDefault(require("fast-deep-equal/es6"));
const build_elastic_body_1 = require("./build-elastic-body");
const constants_1 = require("./constants");
const elasticsearch_index_service_1 = require("./indexing/elasticsearch-index.service");
const indexing_utils_1 = require("./indexing/indexing-utils");
let ElasticsearchService = ElasticsearchService_1 = class ElasticsearchService {
    constructor(options, searchService, elasticsearchIndexService, configService, facetValueService, collectionService, eventBus) {
        this.options = options;
        this.searchService = searchService;
        this.elasticsearchIndexService = elasticsearchIndexService;
        this.configService = configService;
        this.facetValueService = facetValueService;
        this.collectionService = collectionService;
        this.eventBus = eventBus;
        searchService.adopt(this);
    }
    onModuleInit() {
        this.client = (0, indexing_utils_1.getClient)(this.options);
    }
    onModuleDestroy() {
        return this.client.close();
    }
    async checkConnection() {
        await new Promise(async (resolve, reject) => {
            const { connectionAttempts, connectionAttemptInterval } = this.options;
            let attempts = 0;
            core_1.Logger.verbose('Pinging Elasticsearch...', constants_1.loggerCtx);
            while (attempts < connectionAttempts) {
                attempts++;
                try {
                    const pingResult = await this.client.ping({}, { requestTimeout: 1000 });
                    if (pingResult.body) {
                        core_1.Logger.verbose('Ping to Elasticsearch successful', constants_1.loggerCtx);
                        return resolve();
                    }
                }
                catch (e) {
                    core_1.Logger.verbose(`Ping to Elasticsearch failed with error "${e.message}"`, constants_1.loggerCtx);
                }
                core_1.Logger.verbose(`Connection to Elasticsearch could not be made, trying again after ${connectionAttemptInterval}ms (attempt ${attempts} of ${connectionAttempts})`, constants_1.loggerCtx);
                await new Promise(resolve1 => setTimeout(resolve1, connectionAttemptInterval));
            }
            reject('Could not connection to Elasticsearch. Aborting bootstrap.');
        });
    }
    async createIndicesIfNotExists() {
        const { indexPrefix } = this.options;
        const createIndex = async (indexName) => {
            const index = indexPrefix + indexName;
            const result = await this.client.indices.exists({ index });
            if (!result.body) {
                core_1.Logger.verbose(`Index "${index}" does not exist. Creating...`, constants_1.loggerCtx);
                await (0, indexing_utils_1.createIndices)(this.client, indexPrefix, this.options.indexSettings, this.options.indexMappingProperties);
            }
            else {
                core_1.Logger.verbose(`Index "${index}" exists`, constants_1.loggerCtx);
                const existingIndexSettingsResult = await this.client.indices.getSettings({ index });
                const existingIndexSettings = existingIndexSettingsResult.body[Object.keys(existingIndexSettingsResult.body)[0]]
                    .settings.index;
                const tempName = new Date().getTime();
                const nameSalt = Math.random().toString(36).substring(7);
                const tempPrefix = 'temp-' + `${tempName}-${nameSalt}-`;
                const tempIndex = tempPrefix + indexName;
                await (0, indexing_utils_1.createIndices)(this.client, tempPrefix, this.options.indexSettings, this.options.indexMappingProperties, false);
                const tempIndexSettingsResult = await this.client.indices.getSettings({ index: tempIndex });
                const tempIndexSettings = tempIndexSettingsResult.body[tempIndex].settings.index;
                const indexParamsToExclude = [
                    'routing',
                    'number_of_shards',
                    'provided_name',
                    'creation_date',
                    'number_of_replicas',
                    'uuid',
                    'version',
                ];
                for (const param of indexParamsToExclude) {
                    delete tempIndexSettings[param];
                    delete existingIndexSettings[param];
                }
                if (!(0, es6_1.default)(tempIndexSettings, existingIndexSettings))
                    core_1.Logger.warn(`Index "${index}" settings differs from index setting in vendure config! Consider re-indexing the data.`, constants_1.loggerCtx);
                else {
                    const existingIndexMappingsResult = await this.client.indices.getMapping({ index });
                    const existingIndexMappings = existingIndexMappingsResult.body[Object.keys(existingIndexMappingsResult.body)[0]]
                        .mappings;
                    const tempIndexMappingsResult = await this.client.indices.getMapping({
                        index: tempIndex,
                    });
                    const tempIndexMappings = tempIndexMappingsResult.body[tempIndex].mappings;
                    if (!(0, es6_1.default)(tempIndexMappings, existingIndexMappings))
                        // eslint-disable-next-line max-len
                        core_1.Logger.warn(`Index "${index}" mapping differs from index mapping in vendure config! Consider re-indexing the data.`, constants_1.loggerCtx);
                }
                await this.client.indices.delete({
                    index: [tempPrefix + 'variants'],
                });
            }
        };
        await createIndex(constants_1.VARIANT_INDEX_NAME);
    }
    /**
     * Perform a fulltext search according to the provided input arguments.
     */
    async search(ctx, input, enabledOnly = false) {
        const { indexPrefix } = this.options;
        const { groupByProduct, groupBySKU } = input;
        const elasticSearchBody = (0, build_elastic_body_1.buildElasticBody)(input, this.options.searchConfig, ctx.channelId, ctx.languageCode, enabledOnly, ctx);
        if (groupByProduct && groupBySKU) {
            throw new core_1.InternalServerError('Cannot use both groupByProduct and groupBySKU simultaneously. Please set only one of these options to true.');
        }
        if (groupByProduct || groupBySKU) {
            try {
                const { body } = await this.client.search({
                    index: indexPrefix + constants_1.VARIANT_INDEX_NAME,
                    body: elasticSearchBody,
                });
                const totalItems = await this.totalHits(ctx, input, enabledOnly);
                await this.eventBus.publish(new core_1.SearchEvent(ctx, input));
                return {
                    items: body.hits.hits.map(hit => this.mapProductToSearchResult(hit, groupByProduct, groupBySKU)),
                    totalItems,
                };
            }
            catch (e) {
                if (e.meta.body.error.type && e.meta.body.error.type === 'search_phase_execution_exception') {
                    // Log runtime error of the script exception instead of stacktrace
                    core_1.Logger.error(e.message, constants_1.loggerCtx, JSON.stringify(e.meta.body.error.root_cause || [], null, 2));
                    core_1.Logger.verbose(JSON.stringify(e.meta.body.error.failed_shards || [], null, 2), constants_1.loggerCtx);
                }
                else {
                    core_1.Logger.error(e.message, constants_1.loggerCtx, e.stack);
                }
                throw e;
            }
        }
        else {
            try {
                const { body } = await this.client.search({
                    index: indexPrefix + constants_1.VARIANT_INDEX_NAME,
                    body: elasticSearchBody,
                });
                await this.eventBus.publish(new core_1.SearchEvent(ctx, input));
                return {
                    items: body.hits.hits.map(hit => this.mapVariantToSearchResult(hit)),
                    totalItems: body.hits.total ? body.hits.total.value : 0,
                };
            }
            catch (e) {
                if (e.meta.body.error.type && e.meta.body.error.type === 'search_phase_execution_exception') {
                    // Log runtime error of the script exception instead of stacktrace
                    core_1.Logger.error(e.message, constants_1.loggerCtx, JSON.stringify(e.meta.body.error.root_cause || [], null, 2));
                    core_1.Logger.verbose(JSON.stringify(e.meta.body.error.failed_shards || [], null, 2), constants_1.loggerCtx);
                }
                else {
                    core_1.Logger.error(e.message, constants_1.loggerCtx, e.stack);
                }
                throw e;
            }
        }
    }
    async totalHits(ctx, input, enabledOnly = false) {
        const { indexPrefix, searchConfig } = this.options;
        const { groupBySKU } = input;
        const elasticSearchBody = (0, build_elastic_body_1.buildElasticBody)(input, searchConfig, ctx.channelId, ctx.languageCode, enabledOnly, ctx);
        elasticSearchBody.from = 0;
        elasticSearchBody.size = 0;
        elasticSearchBody.aggs = {
            total: {
                cardinality: {
                    field: groupBySKU ? 'sku.keyword' : 'productId',
                },
            },
        };
        const { body } = await this.client.search({
            index: indexPrefix + constants_1.VARIANT_INDEX_NAME,
            body: elasticSearchBody,
        });
        const { aggregations } = body;
        if (!aggregations) {
            throw new core_1.InternalServerError('An error occurred when querying Elasticsearch for priceRange aggregations');
        }
        return aggregations.total ? aggregations.total.value : 0;
    }
    /**
     * Return a list of all FacetValues which appear in the result set.
     */
    async facetValues(ctx, input, enabledOnly = false) {
        const { groupByProduct, groupBySKU } = input;
        const buckets = await this.getDistinctBucketsOfField(ctx, input, enabledOnly, 'facetValueIds', this.options.searchConfig.facetValueMaxSize);
        const facetValues = await this.facetValueService.findByIds(ctx, buckets.map(b => b.key));
        return facetValues.map(facetValue => {
            const bucket = buckets.find(b => b.key.toString() === facetValue.id.toString());
            let count;
            if (groupByProduct || groupBySKU) {
                count = bucket ? bucket.total.value : 0;
            }
            else {
                count = bucket ? bucket.doc_count : 0;
            }
            return {
                facetValue,
                count,
            };
        });
    }
    /**
     * Return a list of all Collections which appear in the result set.
     */
    async collections(ctx, input, enabledOnly = false) {
        const { groupByProduct, groupBySKU } = input;
        const buckets = await this.getDistinctBucketsOfField(ctx, input, enabledOnly, 'collectionIds', this.options.searchConfig.collectionMaxSize);
        const collections = await this.collectionService.findByIds(ctx, buckets.map(b => b.key));
        return collections.map(collection => {
            const bucket = buckets.find(b => b.key.toString() === collection.id.toString());
            let count;
            if (groupByProduct || groupBySKU) {
                count = bucket ? bucket.total.value : 0;
            }
            else {
                count = bucket ? bucket.doc_count : 0;
            }
            return {
                collection,
                count,
            };
        });
    }
    async getDistinctBucketsOfField(ctx, input, enabledOnly = false, field, aggregation_max_size) {
        const { indexPrefix } = this.options;
        const { groupByProduct, groupBySKU } = input;
        const elasticSearchBody = (0, build_elastic_body_1.buildElasticBody)(input, this.options.searchConfig, ctx.channelId, ctx.languageCode, enabledOnly, ctx);
        elasticSearchBody.from = 0;
        elasticSearchBody.size = 0;
        elasticSearchBody.aggs = {
            aggregation_field: {
                terms: {
                    field,
                    size: aggregation_max_size,
                },
            },
        };
        if (groupByProduct) {
            elasticSearchBody.aggs.aggregation_field.aggs = {
                total: {
                    cardinality: {
                        field: 'productId',
                    },
                },
            };
        }
        if (groupBySKU) {
            elasticSearchBody.aggs.aggregation_field.aggs = {
                total: {
                    cardinality: {
                        field: 'sku.keyword',
                    },
                },
            };
        }
        let body;
        try {
            const result = await this.client.search({
                index: indexPrefix + constants_1.VARIANT_INDEX_NAME,
                body: elasticSearchBody,
            });
            body = result.body;
        }
        catch (e) {
            core_1.Logger.error(e.message, constants_1.loggerCtx, e.stack);
            throw e;
        }
        return body.aggregations ? body.aggregations.aggregation_field.buckets : [];
    }
    async priceRange(ctx, input) {
        const { indexPrefix, searchConfig } = this.options;
        const elasticSearchBody = (0, build_elastic_body_1.buildElasticBody)(input, searchConfig, ctx.channelId, ctx.languageCode, true, ctx);
        elasticSearchBody.from = 0;
        elasticSearchBody.size = 0;
        elasticSearchBody.aggs = {
            minPrice: {
                min: {
                    field: 'price',
                },
            },
            minPriceWithTax: {
                min: {
                    field: 'priceWithTax',
                },
            },
            maxPrice: {
                max: {
                    field: 'price',
                },
            },
            maxPriceWithTax: {
                max: {
                    field: 'priceWithTax',
                },
            },
            prices: {
                histogram: {
                    field: 'price',
                    interval: searchConfig.priceRangeBucketInterval,
                },
            },
            pricesWithTax: {
                histogram: {
                    field: 'priceWithTax',
                    interval: searchConfig.priceRangeBucketInterval,
                },
            },
        };
        const { body } = await this.client.search({
            index: indexPrefix + constants_1.VARIANT_INDEX_NAME,
            body: elasticSearchBody,
        });
        const { aggregations } = body;
        if (!aggregations) {
            throw new core_1.InternalServerError('An error occurred when querying Elasticsearch for priceRange aggregations');
        }
        const mapPriceBuckets = (b) => ({
            to: Number.parseInt(b.key, 10) + searchConfig.priceRangeBucketInterval,
            count: b.doc_count,
        });
        return {
            range: {
                min: aggregations.minPrice.value || 0,
                max: aggregations.maxPrice.value || 0,
            },
            rangeWithTax: {
                min: aggregations.minPriceWithTax.value || 0,
                max: aggregations.maxPriceWithTax.value || 0,
            },
            buckets: aggregations.prices.buckets.map(mapPriceBuckets).filter(x => 0 < x.count),
            bucketsWithTax: aggregations.pricesWithTax.buckets.map(mapPriceBuckets).filter(x => 0 < x.count),
        };
    }
    /**
     * Rebuilds the full search index.
     */
    async reindex(ctx) {
        const job = await this.elasticsearchIndexService.reindex(ctx);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return job;
    }
    mapVariantToSearchResult(hit) {
        var _a;
        const source = hit._source;
        const fields = hit.fields;
        const { productAsset, productVariantAsset } = this.getSearchResultAssets(source);
        const result = Object.assign(Object.assign({}, source), { productAsset,
            productVariantAsset, price: {
                value: source.price,
            }, priceWithTax: {
                value: source.priceWithTax,
            }, score: hit._score || 0 });
        ElasticsearchService_1.addCustomMappings(result, source, this.options.customProductMappings, this.options.customProductVariantMappings, false, false);
        ElasticsearchService_1.addScriptMappings(result, fields, (_a = this.options.searchConfig) === null || _a === void 0 ? void 0 : _a.scriptFields, 'variant');
        return result;
    }
    mapProductToSearchResult(hit, groupByProduct = false, groupBySKU = false) {
        var _a;
        const source = hit._source;
        const fields = hit.fields;
        const { productAsset, productVariantAsset } = this.getSearchResultAssets(source);
        const result = Object.assign(Object.assign({}, source), { productAsset,
            productVariantAsset, enabled: source.productEnabled, productId: source.productId.toString(), productName: source.productName, productVariantId: source.productVariantId.toString(), productVariantName: source.productVariantName, facetIds: source.productFacetIds, facetValueIds: source.productFacetValueIds, collectionIds: source.productCollectionIds, sku: source.sku, slug: source.slug, price: {
                min: source.productPriceMin,
                max: source.productPriceMax,
            }, priceWithTax: {
                min: source.productPriceWithTaxMin,
                max: source.productPriceWithTaxMax,
            }, channelIds: [], inStock: source.productInStock, score: hit._score || 0 });
        ElasticsearchService_1.addCustomMappings(result, source, this.options.customProductMappings, this.options.customProductVariantMappings, groupByProduct, groupBySKU);
        ElasticsearchService_1.addScriptMappings(result, fields, (_a = this.options.searchConfig) === null || _a === void 0 ? void 0 : _a.scriptFields, 'product');
        return result;
    }
    getSearchResultAssets(source) {
        const productAsset = source.productAssetId
            ? {
                id: source.productAssetId.toString(),
                preview: source.productPreview,
                focalPoint: source.productPreviewFocalPoint,
            }
            : undefined;
        const productVariantAsset = source.productVariantAssetId
            ? {
                id: source.productVariantAssetId.toString(),
                preview: source.productVariantPreview,
                focalPoint: source.productVariantPreviewFocalPoint,
            }
            : undefined;
        return { productAsset, productVariantAsset };
    }
    static addCustomMappings(result, source, productMappings, variantMappings, groupByProduct, groupBySKU) {
        const productCustomMappings = Object.keys(productMappings);
        if (productCustomMappings.length) {
            const customMappingsResult = {};
            for (const name of productCustomMappings) {
                customMappingsResult[name] = source[`product-${name}`];
            }
            result.customProductMappings = customMappingsResult;
            if (groupByProduct || groupBySKU) {
                result.customMappings = customMappingsResult;
            }
        }
        const variantCustomMappings = Object.keys(variantMappings);
        if (variantCustomMappings.length) {
            const customMappingsResult = {};
            for (const name of variantCustomMappings) {
                customMappingsResult[name] = source[`variant-${name}`];
            }
            result.customProductVariantMappings = customMappingsResult;
            if (!groupByProduct && !groupBySKU) {
                result.customMappings = customMappingsResult;
            }
        }
        return result;
    }
    static addScriptMappings(result, fields, mappings, environment) {
        const customMappings = Object.keys(mappings || {});
        if (customMappings.length) {
            const customScriptFieldsResult = {};
            for (const name of customMappings) {
                const env = mappings[name].context;
                if (env === environment || env === 'both') {
                    const fieldVal = fields[name] || undefined;
                    if (Array.isArray(fieldVal)) {
                        if (fieldVal.length === 1) {
                            customScriptFieldsResult[name] = fieldVal[0];
                        }
                        if (fieldVal.length > 1) {
                            customScriptFieldsResult[name] = JSON.stringify(fieldVal);
                        }
                    }
                    else {
                        customScriptFieldsResult[name] = fieldVal;
                    }
                }
            }
            result.customScriptFields = customScriptFieldsResult;
        }
        return result;
    }
};
exports.ElasticsearchService = ElasticsearchService;
exports.ElasticsearchService = ElasticsearchService = ElasticsearchService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(constants_1.ELASTIC_SEARCH_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_1.SearchService,
        elasticsearch_index_service_1.ElasticsearchIndexService,
        core_1.ConfigService,
        core_1.FacetValueService,
        core_1.CollectionService,
        core_1.EventBus])
], ElasticsearchService);
//# sourceMappingURL=elasticsearch.service.js.map