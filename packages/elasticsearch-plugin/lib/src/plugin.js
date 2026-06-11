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
var ElasticsearchPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElasticsearchPlugin = void 0;
const core_1 = require("@vendure/core");
const operators_1 = require("rxjs/operators");
const api_extensions_1 = require("./api/api-extensions");
const custom_mappings_resolver_1 = require("./api/custom-mappings.resolver");
const custom_script_fields_resolver_1 = require("./api/custom-script-fields.resolver");
const elasticsearch_resolver_1 = require("./api/elasticsearch-resolver");
const constants_1 = require("./constants");
const elasticsearch_health_1 = require("./elasticsearch.health");
const elasticsearch_service_1 = require("./elasticsearch.service");
const elasticsearch_index_service_1 = require("./indexing/elasticsearch-index.service");
const indexer_controller_1 = require("./indexing/indexer.controller");
const options_1 = require("./options");
function getCustomResolvers(options) {
    const requiresUnionResolver = 0 < Object.keys(options.customProductMappings || {}).length &&
        0 < Object.keys(options.customProductVariantMappings || {}).length;
    const requiresUnionScriptResolver = 0 <
        Object.values(options.searchConfig.scriptFields || {}).filter(field => field.context !== 'product').length &&
        0 <
            Object.values(options.searchConfig.scriptFields || {}).filter(field => field.context !== 'variant').length;
    return [
        ...(requiresUnionResolver ? [custom_mappings_resolver_1.CustomMappingsResolver] : []),
        ...(requiresUnionScriptResolver ? [custom_script_fields_resolver_1.CustomScriptFieldsResolver] : []),
    ];
}
/**
 * @description
 * This plugin allows your product search to be powered by [Elasticsearch](https://github.com/elastic/elasticsearch) - a powerful Open Source search
 * engine. This is a drop-in replacement for the DefaultSearchPlugin which exposes many powerful configuration options enabling your storefront
 * to support a wide range of use-cases such as indexing of custom properties, fine control over search index configuration, and to leverage
 * advanced Elasticsearch features like spacial search.
 *
 * ## Installation
 *
 * **Requires Elasticsearch v7.0 < required Elasticsearch version < 7.10 **
 * Elasticsearch version 7.10.2 will throw error due to incompatibility with elasticsearch-js client.
 * [Check here for more info](https://github.com/elastic/elasticsearch-js/issues/1519).
 *
 * `yarn add \@elastic/elasticsearch \@vendure/elasticsearch-plugin`
 *
 * or
 *
 * `npm install \@elastic/elasticsearch \@vendure/elasticsearch-plugin`
 *
 * Make sure to remove the `DefaultSearchPlugin` if it is still in the VendureConfig plugins array.
 *
 * Then add the `ElasticsearchPlugin`, calling the `.init()` method with {@link ElasticsearchOptions}:
 *
 * @example
 * ```ts
 * import { ElasticsearchPlugin } from '\@vendure/elasticsearch-plugin';
 *
 * const config: VendureConfig = {
 *   // Add an instance of the plugin to the plugins array
 *   plugins: [
 *     ElasticsearchPlugin.init({
 *       host: 'http://localhost',
 *       port: 9200,
 *     }),
 *   ],
 * };
 * ```
 *
 * ## Search API Extensions
 * This plugin extends the default search query of the Shop API, allowing richer querying of your product data.
 *
 * The [SearchResponse](/reference/graphql-api/shop/object-types/#searchresponse) type is extended with information
 * about price ranges in the result set:
 * ```graphql
 * extend type SearchResponse {
 *     prices: SearchResponsePriceData!
 * }
 *
 * type SearchResponsePriceData {
 *     range: PriceRange!
 *     rangeWithTax: PriceRange!
 *     buckets: [PriceRangeBucket!]!
 *     bucketsWithTax: [PriceRangeBucket!]!
 * }
 *
 * type PriceRangeBucket {
 *     to: Int!
 *     count: Int!
 * }
 *
 * extend input SearchInput {
 *     priceRange: PriceRangeInput
 *     priceRangeWithTax: PriceRangeInput
 *     inStock: Boolean
 * }
 *
 * input PriceRangeInput {
 *     min: Int!
 *     max: Int!
 * }
 * ```
 *
 * This `SearchResponsePriceData` type allows you to query data about the range of prices in the result set.
 *
 * ## Example Request & Response
 *
 * ```graphql
 * {
 *   search (input: {
 *     term: "table easel"
 *     groupByProduct: true
 *     priceRange: {
         min: 500
         max: 7000
       }
 *   }) {
 *     totalItems
 *     prices {
 *       range {
 *         min
 *         max
 *       }
 *       buckets {
 *         to
 *         count
 *       }
 *     }
 *     items {
 *       productName
 *       score
 *       price {
 *         ...on PriceRange {
 *           min
 *           max
 *         }
 *       }
 *     }
 *   }
 * }
 * ```
 *
 * ```json
 *{
 *  "data": {
 *    "search": {
 *      "totalItems": 9,
 *      "prices": {
 *        "range": {
 *          "min": 999,
 *          "max": 6396,
 *        },
 *        "buckets": [
 *          {
 *            "to": 1000,
 *            "count": 1
 *          },
 *          {
 *            "to": 2000,
 *            "count": 2
 *          },
 *          {
 *            "to": 3000,
 *            "count": 3
 *          },
 *          {
 *            "to": 4000,
 *            "count": 1
 *          },
 *          {
 *            "to": 5000,
 *            "count": 1
 *          },
 *          {
 *            "to": 7000,
 *            "count": 1
 *          }
 *        ]
 *      },
 *      "items": [
 *        {
 *          "productName": "Loxley Yorkshire Table Easel",
 *          "score": 30.58831,
 *          "price": {
 *            "min": 4984,
 *            "max": 4984
 *          }
 *        },
 *        // ... truncated
 *      ]
 *    }
 *  }
 *}
 * ```
 *
 * @docsCategory core plugins/ElasticsearchPlugin
 */
let ElasticsearchPlugin = ElasticsearchPlugin_1 = class ElasticsearchPlugin {
    /** @internal */
    constructor(eventBus, elasticsearchService, elasticsearchIndexService, elasticsearchHealthIndicator, healthCheckRegistryService) {
        this.eventBus = eventBus;
        this.elasticsearchService = elasticsearchService;
        this.elasticsearchIndexService = elasticsearchIndexService;
        this.elasticsearchHealthIndicator = elasticsearchHealthIndicator;
        this.healthCheckRegistryService = healthCheckRegistryService;
    }
    /**
     * Set the plugin options.
     */
    static init(options) {
        this.options = (0, options_1.mergeWithDefaults)(options);
        return ElasticsearchPlugin_1;
    }
    /** @internal */
    async onApplicationBootstrap() {
        const nodeName = this.nodeName();
        try {
            await this.elasticsearchService.checkConnection();
        }
        catch (e) {
            core_1.Logger.error(`Could not connect to Elasticsearch instance at "${nodeName}"`, constants_1.loggerCtx);
            core_1.Logger.error(JSON.stringify(e), constants_1.loggerCtx);
            this.healthCheckRegistryService.registerIndicatorFunction(() => this.elasticsearchHealthIndicator.startupCheckFailed(e.message));
            return;
        }
        core_1.Logger.info(`Successfully connected to Elasticsearch instance at "${nodeName}"`, constants_1.loggerCtx);
        await this.elasticsearchService.createIndicesIfNotExists();
        this.healthCheckRegistryService.registerIndicatorFunction(() => this.elasticsearchHealthIndicator.isHealthy());
        this.eventBus.ofType(core_1.ProductEvent).subscribe(event => {
            if (event.type === 'deleted') {
                return this.elasticsearchIndexService.deleteProduct(event.ctx, event.product);
            }
            else {
                return this.elasticsearchIndexService.updateProduct(event.ctx, event.product);
            }
        });
        this.eventBus.ofType(core_1.ProductVariantEvent).subscribe(event => {
            if (event.type === 'deleted') {
                return this.elasticsearchIndexService.deleteVariant(event.ctx, event.variants);
            }
            else {
                return this.elasticsearchIndexService.updateVariants(event.ctx, event.variants);
            }
        });
        this.eventBus.ofType(core_1.AssetEvent).subscribe(event => {
            if (event.type === 'updated') {
                return this.elasticsearchIndexService.updateAsset(event.ctx, event.asset);
            }
            if (event.type === 'deleted') {
                return this.elasticsearchIndexService.deleteAsset(event.ctx, event.asset);
            }
        });
        this.eventBus.ofType(core_1.ProductChannelEvent).subscribe(event => {
            if (event.type === 'assigned') {
                return this.elasticsearchIndexService.assignProductToChannel(event.ctx, event.product, event.channelId);
            }
            else {
                return this.elasticsearchIndexService.removeProductFromChannel(event.ctx, event.product, event.channelId);
            }
        });
        this.eventBus.ofType(core_1.ProductVariantChannelEvent).subscribe(event => {
            if (event.type === 'assigned') {
                return this.elasticsearchIndexService.assignVariantToChannel(event.ctx, event.productVariant.id, event.channelId);
            }
            else {
                return this.elasticsearchIndexService.removeVariantFromChannel(event.ctx, event.productVariant.id, event.channelId);
            }
        });
        this.eventBus.ofType(core_1.StockMovementEvent).subscribe(event => {
            return this.elasticsearchIndexService.updateVariants(event.ctx, event.stockMovements.map(m => m.productVariant));
        });
        // TODO: Remove this buffering logic because because we have dedicated buffering based on #1137
        const collectionModification$ = this.eventBus.ofType(core_1.CollectionModificationEvent);
        const closingNotifier$ = collectionModification$.pipe((0, operators_1.debounceTime)(50));
        collectionModification$
            .pipe((0, operators_1.buffer)(closingNotifier$), (0, operators_1.filter)(events => 0 < events.length), (0, operators_1.map)(events => ({
            ctx: events[0].ctx,
            ids: events.reduce((ids, e) => [...ids, ...e.productVariantIds], []),
        })), (0, operators_1.filter)(e => 0 < e.ids.length))
            .subscribe(events => {
            return this.elasticsearchIndexService.updateVariantsById(events.ctx, events.ids);
        });
        this.eventBus
            .ofType(core_1.TaxRateModificationEvent)
            // The delay prevents a "TransactionNotStartedError" (in SQLite/sqljs) by allowing any existing
            // transactions to complete before a new job is added to the queue (assuming the SQL-based
            // JobQueueStrategy).
            // TODO: should be able to remove owing to f0fd6625
            .pipe((0, operators_1.delay)(1))
            .subscribe(event => {
            const defaultTaxZone = event.ctx.channel.defaultTaxZone;
            if (defaultTaxZone && (0, core_1.idsAreEqual)(defaultTaxZone.id, event.taxRate.zone.id)) {
                return this.elasticsearchService.reindex(event.ctx);
            }
        });
    }
    /**
     * Returns a string representation of the target node(s) that the Elasticsearch
     * client is configured to connect to.
     */
    nodeName() {
        const { host, port, clientOptions } = ElasticsearchPlugin_1.options;
        const node = clientOptions === null || clientOptions === void 0 ? void 0 : clientOptions.node;
        const nodes = clientOptions === null || clientOptions === void 0 ? void 0 : clientOptions.nodes;
        if (nodes) {
            return [...(Array.isArray(nodes) ? nodes : [nodes])].join(', ');
        }
        if (node) {
            if (Array.isArray(node)) {
                return node
                    .map((n) => {
                    return typeof n === 'string' ? n : n.url.toString();
                })
                    .join(', ');
            }
            else {
                return typeof node === 'string' ? node : node.url.toString();
            }
        }
        return `${host}:${port}`;
    }
};
exports.ElasticsearchPlugin = ElasticsearchPlugin;
exports.ElasticsearchPlugin = ElasticsearchPlugin = ElasticsearchPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        providers: [
            elasticsearch_index_service_1.ElasticsearchIndexService,
            elasticsearch_service_1.ElasticsearchService,
            elasticsearch_health_1.ElasticsearchHealthIndicator,
            indexer_controller_1.ElasticsearchIndexerController,
            core_1.SearchJobBufferService,
            { provide: constants_1.ELASTIC_SEARCH_OPTIONS, useFactory: () => ElasticsearchPlugin.options },
            {
                provide: core_1.BUFFER_SEARCH_INDEX_UPDATES,
                useFactory: () => ElasticsearchPlugin.options.bufferUpdates === true,
            },
        ],
        adminApiExtensions: {
            resolvers: () => [
                elasticsearch_resolver_1.AdminElasticSearchResolver,
                elasticsearch_resolver_1.EntityElasticSearchResolver,
                ...getCustomResolvers(ElasticsearchPlugin.options),
            ],
            schema: () => (0, api_extensions_1.generateSchemaExtensions)(ElasticsearchPlugin.options),
        },
        shopApiExtensions: {
            resolvers: () => [
                elasticsearch_resolver_1.ShopElasticSearchResolver,
                elasticsearch_resolver_1.EntityElasticSearchResolver,
                ...getCustomResolvers(ElasticsearchPlugin.options),
            ],
            // `any` cast is there due to a strange error "Property '[Symbol.iterator]' is missing in type... URLSearchParams"
            // which looks like possibly a TS/definitions bug.
            schema: () => (0, api_extensions_1.generateSchemaExtensions)(ElasticsearchPlugin.options),
        },
        compatibility: '^3.0.0',
    }),
    __metadata("design:paramtypes", [core_1.EventBus,
        elasticsearch_service_1.ElasticsearchService,
        elasticsearch_index_service_1.ElasticsearchIndexService,
        elasticsearch_health_1.ElasticsearchHealthIndicator,
        core_1.HealthCheckRegistryService])
], ElasticsearchPlugin);
//# sourceMappingURL=plugin.js.map