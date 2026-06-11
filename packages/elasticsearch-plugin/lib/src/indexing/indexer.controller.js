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
var ElasticsearchIndexerController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElasticsearchIndexerController = exports.defaultVariantRelations = exports.defaultProductRelations = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const unique_1 = require("@vendure/common/lib/unique");
const core_2 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const constants_1 = require("../constants");
const indexing_utils_1 = require("./indexing-utils");
exports.defaultProductRelations = [
    'featuredAsset',
    'facetValues',
    'facetValues.facet',
    'channels',
    'channels.defaultTaxZone',
];
exports.defaultVariantRelations = [
    'featuredAsset',
    'facetValues',
    'facetValues.facet',
    'collections',
    'taxCategory',
    'channels',
    'channels.defaultTaxZone',
];
let ElasticsearchIndexerController = ElasticsearchIndexerController_1 = class ElasticsearchIndexerController {
    constructor(connection, options, productPriceApplicator, configService, productVariantService, requestContextCache, moduleRef) {
        this.connection = connection;
        this.options = options;
        this.productPriceApplicator = productPriceApplicator;
        this.configService = configService;
        this.productVariantService = productVariantService;
        this.requestContextCache = requestContextCache;
        this.moduleRef = moduleRef;
        this.asyncQueue = new core_2.AsyncQueue('elasticsearch-indexer', 5);
    }
    onModuleInit() {
        this.client = (0, indexing_utils_1.getClient)(this.options);
        this.productRelations = this.getReindexRelations(exports.defaultProductRelations, this.options.hydrateProductRelations);
        this.variantRelations = this.getReindexRelations(exports.defaultVariantRelations, this.options.hydrateProductVariantRelations);
        this.injector = new core_2.Injector(this.moduleRef);
    }
    onModuleDestroy() {
        return this.client.close();
    }
    /**
     * Updates the search index only for the affected product.
     */
    async updateProduct({ ctx: rawContext, productId }) {
        const ctx = core_2.MutableRequestContext.deserialize(rawContext);
        await this.updateProductsInternal(ctx, [productId]);
        return true;
    }
    /**
     * Updates the search index only for the affected product.
     */
    async deleteProduct({ ctx: rawContext, productId }) {
        await this.deleteProductOperations(core_2.RequestContext.deserialize(rawContext), productId);
        return true;
    }
    /**
     * Updates the search index only for the affected product.
     */
    async assignProductToChannel({ ctx: rawContext, productId, channelId, }) {
        const ctx = core_2.MutableRequestContext.deserialize(rawContext);
        await this.updateProductsInternal(ctx, [productId]);
        return true;
    }
    /**
     * Updates the search index only for the affected product.
     */
    async removeProductFromChannel({ ctx: rawContext, productId, channelId, }) {
        const ctx = core_2.MutableRequestContext.deserialize(rawContext);
        await this.updateProductsInternal(ctx, [productId]);
        return true;
    }
    async assignVariantToChannel({ ctx: rawContext, productVariantId, channelId, }) {
        const productIds = await this.getProductIdsByVariantIds([productVariantId]);
        const ctx = core_2.MutableRequestContext.deserialize(rawContext);
        await this.updateProductsInternal(ctx, productIds);
        return true;
    }
    async removeVariantFromChannel({ ctx: rawContext, productVariantId, channelId, }) {
        const productIds = await this.getProductIdsByVariantIds([productVariantId]);
        const ctx = core_2.MutableRequestContext.deserialize(rawContext);
        await this.updateProductsInternal(ctx, productIds);
        return true;
    }
    /**
     * Updates the search index only for the affected entities.
     */
    async updateVariants({ ctx: rawContext, variantIds }) {
        const ctx = core_2.MutableRequestContext.deserialize(rawContext);
        return this.asyncQueue.push(async () => {
            const productIds = await this.getProductIdsByVariantIds(variantIds);
            await this.updateProductsInternal(ctx, productIds);
            return true;
        });
    }
    async deleteVariants({ ctx: rawContext, variantIds }) {
        const ctx = core_2.MutableRequestContext.deserialize(rawContext);
        const productIds = await this.getProductIdsByVariantIds(variantIds);
        for (const productId of productIds) {
            await this.updateProductsInternal(ctx, [productId]);
        }
        return true;
    }
    updateVariantsById({ ctx: rawContext, ids, }) {
        const ctx = core_2.MutableRequestContext.deserialize(rawContext);
        return (0, core_2.asyncObservable)(async (observer) => {
            return this.asyncQueue.push(async () => {
                const timeStart = Date.now();
                const productIds = await this.getProductIdsByVariantIds(ids);
                if (productIds.length) {
                    let finishedProductsCount = 0;
                    for (const productId of productIds) {
                        await this.updateProductsInternal(ctx, [productId]);
                        finishedProductsCount++;
                        observer.next({
                            total: productIds.length,
                            completed: Math.min(finishedProductsCount, productIds.length),
                            duration: +new Date() - timeStart,
                        });
                    }
                }
                core_2.Logger.verbose('Completed updating variants', constants_1.loggerCtx);
                return {
                    total: productIds.length,
                    completed: productIds.length,
                    duration: +new Date() - timeStart,
                };
            });
        });
    }
    reindex({ ctx: rawContext }) {
        return (0, core_2.asyncObservable)(async (observer) => {
            return this.asyncQueue.push(async () => {
                const timeStart = Date.now();
                const ctx = core_2.MutableRequestContext.deserialize(rawContext);
                const reindexTempName = new Date().getTime();
                const variantIndexName = `${this.options.indexPrefix}${constants_1.VARIANT_INDEX_NAME}`;
                const variantIndexNameForReindex = `${constants_1.VARIANT_INDEX_NAME}-reindex-${reindexTempName}`;
                const reindexVariantAliasName = `${this.options.indexPrefix}${variantIndexNameForReindex}`;
                try {
                    await (0, indexing_utils_1.createIndices)(this.client, this.options.indexPrefix, this.options.indexSettings, this.options.indexMappingProperties, true, `-reindex-${reindexTempName}`);
                }
                catch (e) {
                    core_2.Logger.error('Could not recreate indices.', constants_1.loggerCtx);
                    core_2.Logger.error(JSON.stringify(e), constants_1.loggerCtx);
                    throw e;
                }
                const totalProductIds = await this.connection.rawConnection
                    .getRepository(core_2.Product)
                    .createQueryBuilder('product')
                    .where('product.deletedAt IS NULL')
                    .getCount();
                core_2.Logger.verbose(`Will reindex ${totalProductIds} products`, constants_1.loggerCtx);
                let productIds = [];
                let skip = 0;
                let finishedProductsCount = 0;
                do {
                    productIds = await this.connection.rawConnection
                        .getRepository(core_2.Product)
                        .createQueryBuilder('product')
                        .select('product.id')
                        .where('product.deletedAt IS NULL')
                        .skip(skip)
                        .take(this.options.reindexProductsChunkSize)
                        .getMany();
                    for (const { id: productId } of productIds) {
                        await this.updateProductsOperationsOnly(ctx, productId, variantIndexNameForReindex);
                        finishedProductsCount++;
                        observer.next({
                            total: totalProductIds,
                            completed: Math.min(finishedProductsCount, totalProductIds),
                            duration: +new Date() - timeStart,
                        });
                    }
                    skip += this.options.reindexProductsChunkSize;
                    core_2.Logger.verbose(`Done ${finishedProductsCount} / ${totalProductIds} products`);
                } while (productIds.length >= this.options.reindexProductsChunkSize);
                // Switch the index to the new reindexed one
                await this.switchAlias(reindexVariantAliasName, variantIndexName);
                core_2.Logger.verbose('Completed reindexing!', constants_1.loggerCtx);
                return {
                    total: totalProductIds,
                    completed: totalProductIds,
                    duration: +new Date() - timeStart,
                };
            });
        });
    }
    async executeBulkOperationsByChunks(chunkSize, operations, index = constants_1.VARIANT_INDEX_NAME) {
        core_2.Logger.verbose(`Will execute ${operations.length} bulk update operations with index ${index}`, constants_1.loggerCtx);
        let i;
        let j;
        let processedOperation = 0;
        for (i = 0, j = operations.length; i < j; i += chunkSize) {
            const operationsChunks = operations.slice(i, i + chunkSize);
            await this.executeBulkOperations(operationsChunks, index);
            processedOperation += operationsChunks.length;
            core_2.Logger.verbose(`Executing operation chunks ${processedOperation}/${operations.length}`, constants_1.loggerCtx);
        }
    }
    async updateAsset(data) {
        const result = await this.updateAssetFocalPointForIndex(constants_1.VARIANT_INDEX_NAME, data.asset);
        await this.client.indices.refresh({
            index: [this.options.indexPrefix + constants_1.VARIANT_INDEX_NAME],
        });
        return result;
    }
    async deleteAsset(data) {
        const result = await this.deleteAssetForIndex(constants_1.VARIANT_INDEX_NAME, data.asset);
        await this.client.indices.refresh({
            index: [this.options.indexPrefix + constants_1.VARIANT_INDEX_NAME],
        });
        return result;
    }
    async updateAssetFocalPointForIndex(indexName, asset) {
        const focalPoint = asset.focalPoint || null;
        const params = { focalPoint };
        return this.updateAssetForIndex(indexName, asset, {
            source: 'ctx._source.productPreviewFocalPoint = params.focalPoint',
            params,
        }, {
            source: 'ctx._source.productVariantPreviewFocalPoint = params.focalPoint',
            params,
        });
    }
    async deleteAssetForIndex(indexName, asset) {
        return this.updateAssetForIndex(indexName, asset, { source: 'ctx._source.productAssetId = null' }, { source: 'ctx._source.productVariantAssetId = null' });
    }
    async updateAssetForIndex(indexName, asset, updateProductScript, updateVariantScript) {
        const result1 = await this.client.update_by_query({
            index: this.options.indexPrefix + indexName,
            body: {
                script: updateProductScript,
                query: {
                    term: {
                        productAssetId: asset.id,
                    },
                },
            },
        });
        for (const failure of result1.body.failures) {
            core_2.Logger.error(`${failure.cause.type}: ${failure.cause.reason}`, constants_1.loggerCtx);
        }
        const result2 = await this.client.update_by_query({
            index: this.options.indexPrefix + indexName,
            body: {
                script: updateVariantScript,
                query: {
                    term: {
                        productVariantAssetId: asset.id,
                    },
                },
            },
        });
        for (const failure of result1.body.failures) {
            core_2.Logger.error(`${failure.cause.type}: ${failure.cause.reason}`, constants_1.loggerCtx);
        }
        return result1.body.failures.length === 0 && result2.body.failures === 0;
    }
    async updateProductsInternal(ctx, productIds) {
        await this.updateProductsOperations(ctx, productIds);
    }
    async switchAlias(reindexVariantAliasName, variantIndexName) {
        try {
            const reindexVariantAliasExist = await this.client.indices.existsAlias({
                name: reindexVariantAliasName,
            });
            if (reindexVariantAliasExist) {
                const reindexVariantIndexName = await (0, indexing_utils_1.getIndexNameByAlias)(this.client, reindexVariantAliasName);
                const originalVariantAliasExist = await this.client.indices.existsAlias({
                    name: variantIndexName,
                });
                const originalVariantIndexExist = await this.client.indices.exists({
                    index: variantIndexName,
                });
                const originalVariantIndexName = await (0, indexing_utils_1.getIndexNameByAlias)(this.client, variantIndexName);
                const actions = [
                    {
                        remove: {
                            index: reindexVariantIndexName,
                            alias: reindexVariantAliasName,
                        },
                    },
                    {
                        add: {
                            index: reindexVariantIndexName,
                            alias: variantIndexName,
                        },
                    },
                ];
                if (originalVariantAliasExist.body) {
                    actions.push({
                        remove: {
                            index: originalVariantIndexName,
                            alias: variantIndexName,
                        },
                    });
                }
                else if (originalVariantIndexExist.body) {
                    await this.client.indices.delete({
                        index: [variantIndexName],
                    });
                }
                await this.client.indices.updateAliases({
                    body: {
                        actions,
                    },
                });
                if (originalVariantAliasExist.body) {
                    await this.client.indices.delete({
                        index: [originalVariantIndexName],
                    });
                }
            }
        }
        catch (e) {
            core_2.Logger.error('Could not switch indexes');
        }
        finally {
            const reindexVariantAliasExist = await this.client.indices.existsAlias({
                name: reindexVariantAliasName,
            });
            if (reindexVariantAliasExist.body) {
                const reindexVariantAliasResult = await this.client.indices.getAlias({
                    name: reindexVariantAliasName,
                });
                const reindexVariantIndexName = Object.keys(reindexVariantAliasResult.body)[0];
                await this.client.indices.delete({
                    index: [reindexVariantIndexName],
                });
            }
        }
    }
    async updateProductsOperationsOnly(ctx, productId, index = constants_1.VARIANT_INDEX_NAME) {
        let operations = [];
        let product;
        try {
            product = await this.connection
                .getRepository(ctx, core_2.Product)
                .find({
                where: { id: productId, deletedAt: (0, typeorm_1.IsNull)() },
                relations: this.productRelations,
            })
                .then(result => { var _a; return (_a = result[0]) !== null && _a !== void 0 ? _a : undefined; });
        }
        catch (e) {
            core_2.Logger.error(e.message, constants_1.loggerCtx, e.stack);
            throw e;
        }
        if (!product) {
            return;
        }
        let updatedProductVariants = [];
        try {
            updatedProductVariants = await this.connection.rawConnection.getRepository(core_2.ProductVariant).find({
                relations: this.variantRelations,
                where: {
                    productId,
                    deletedAt: (0, typeorm_1.IsNull)(),
                },
                order: {
                    id: 'ASC',
                },
            });
        }
        catch (e) {
            core_2.Logger.error(e.message, constants_1.loggerCtx, e.stack);
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        updatedProductVariants.forEach(variant => (variant.product = product));
        if (!product.enabled) {
            updatedProductVariants.forEach(v => (v.enabled = false));
        }
        core_2.Logger.debug(`Updating Product (${productId})`, constants_1.loggerCtx);
        const languageVariants = [];
        languageVariants.push(...product.translations.map(t => t.languageCode));
        for (const variant of updatedProductVariants)
            languageVariants.push(...variant.translations.map(t => t.languageCode));
        const uniqueLanguageVariants = (0, unique_1.unique)(languageVariants);
        const originalChannel = ctx.channel;
        for (const channel of product.channels) {
            ctx.setChannel(channel);
            const variantsInChannel = updatedProductVariants.filter(v => v.channels.map(c => c.id).includes(ctx.channelId));
            for (const variant of variantsInChannel)
                await this.productPriceApplicator.applyChannelPriceAndTax(variant, ctx);
            for (const languageCode of uniqueLanguageVariants) {
                if (variantsInChannel.length) {
                    for (const variant of variantsInChannel) {
                        operations.push({
                            index: constants_1.VARIANT_INDEX_NAME,
                            operation: {
                                update: {
                                    _id: ElasticsearchIndexerController_1.getId(variant.id, ctx.channelId, languageCode),
                                },
                            },
                        }, {
                            index: constants_1.VARIANT_INDEX_NAME,
                            operation: {
                                doc: await this.createVariantIndexItem(variant, variantsInChannel, ctx, languageCode),
                                doc_as_upsert: true,
                            },
                        });
                        if (operations.length >= this.options.reindexBulkOperationSizeLimit) {
                            // Because we can have a huge amount of variant for 1 product, we also chunk update operations
                            await this.executeBulkOperationsByChunks(this.options.reindexBulkOperationSizeLimit, operations, index);
                            operations = [];
                        }
                    }
                }
                else {
                    operations.push({
                        index: constants_1.VARIANT_INDEX_NAME,
                        operation: {
                            update: {
                                _id: ElasticsearchIndexerController_1.getId(-product.id, ctx.channelId, languageCode),
                            },
                        },
                    }, {
                        index: constants_1.VARIANT_INDEX_NAME,
                        operation: {
                            doc: await this.createSyntheticProductIndexItem(product, ctx, languageCode),
                            doc_as_upsert: true,
                        },
                    });
                }
                if (operations.length >= this.options.reindexBulkOperationSizeLimit) {
                    // Because we can have a huge amount of variant for 1 product, we also chunk update operations
                    await this.executeBulkOperationsByChunks(this.options.reindexBulkOperationSizeLimit, operations, index);
                    operations = [];
                }
            }
        }
        ctx.setChannel(originalChannel);
        // Because we can have a huge amount of variant for 1 product, we also chunk update operations
        await this.executeBulkOperationsByChunks(this.options.reindexBulkOperationSizeLimit, operations, index);
        return;
    }
    async updateProductsOperations(ctx, productIds) {
        core_2.Logger.debug(`Updating ${productIds.length} Products`, constants_1.loggerCtx);
        for (const productId of productIds) {
            await this.deleteProductOperations(ctx, productId);
            await this.updateProductsOperationsOnly(ctx, productId);
        }
        return;
    }
    /**
     * Takes the default relations, and combines them with any extra relations specified in the
     * `hydrateProductRelations` and `hydrateProductVariantRelations`. This method also ensures
     * that the relation values are unique and that paths are fully expanded.
     *
     * This means that if a `hydrateProductRelations` value of `['assets.asset']` is specified,
     * this method will also add `['assets']` to the relations array, otherwise TypeORM would
     * throw an error trying to join a 2nd-level deep relation without the first level also
     * being joined.
     */
    getReindexRelations(defaultRelations, hydratedRelations) {
        const uniqueRelations = (0, unique_1.unique)([...defaultRelations, ...hydratedRelations]);
        for (const relation of hydratedRelations) {
            let path = relation.split('.');
            if (path[0] === 'customFields') {
                if (path.length > 2) {
                    throw new core_2.InternalServerError([
                        'hydrateProductRelations / hydrateProductVariantRelations does not currently support nested custom field relations',
                        `Received: "${relation}"`,
                    ].join('\n'));
                }
                path = [path.join('.')];
            }
            const pathToPart = [];
            for (const part of path) {
                pathToPart.push(part);
                const joinedPath = pathToPart.join('.');
                if (!uniqueRelations.includes(joinedPath)) {
                    uniqueRelations.push(joinedPath);
                }
            }
        }
        return uniqueRelations;
    }
    async deleteProductOperations(ctx, productId, index = constants_1.VARIANT_INDEX_NAME) {
        const channels = await this.requestContextCache.get(ctx, 'elastic-index-all-channels', () => this.connection.rawConnection
            .getRepository(core_2.Channel)
            .createQueryBuilder('channel')
            .select('channel.id')
            .getMany());
        const product = await this.connection
            .getRepository(ctx, core_2.Product)
            .createQueryBuilder('product')
            .select([
            'product.id',
            'productVariant.id',
            'productTranslations.languageCode',
            'productVariantTranslations.languageCode',
        ])
            .leftJoin('product.translations', 'productTranslations')
            .leftJoin('product.variants', 'productVariant')
            .leftJoin('productVariant.translations', 'productVariantTranslations')
            .leftJoin('product.channels', 'channel')
            .where('product.id = :productId', { productId })
            .andWhere('channel.id = :channelId', { channelId: ctx.channelId })
            .getOne();
        if (!product)
            return;
        core_2.Logger.debug(`Deleting 1 Product (id: ${productId})`, constants_1.loggerCtx);
        let operations = [];
        const languageVariants = [];
        languageVariants.push(...product.translations.map(t => t.languageCode));
        for (const variant of product.variants)
            languageVariants.push(...variant.translations.map(t => t.languageCode));
        const uniqueLanguageVariants = (0, unique_1.unique)(languageVariants);
        for (const { id: channelId } of channels) {
            for (const languageCode of uniqueLanguageVariants) {
                operations.push({
                    index: constants_1.VARIANT_INDEX_NAME,
                    operation: {
                        delete: {
                            _id: ElasticsearchIndexerController_1.getId(-product.id, channelId, languageCode),
                        },
                    },
                });
                if (operations.length >= this.options.reindexBulkOperationSizeLimit) {
                    // Because we can have a huge amount of variant for 1 product, we also chunk update operations
                    await this.executeBulkOperationsByChunks(this.options.reindexBulkOperationSizeLimit, operations, index);
                    operations = [];
                }
            }
        }
        // Because we can have a huge amount of variant for 1 product, we also chunk update operations
        await this.executeBulkOperationsByChunks(this.options.reindexBulkOperationSizeLimit, operations, index);
        await this.deleteVariantsInternalOperations(product.variants, channels.map(c => c.id), uniqueLanguageVariants, index);
        return;
    }
    async deleteVariantsInternalOperations(variants, channelIds, languageVariants, index = constants_1.VARIANT_INDEX_NAME) {
        core_2.Logger.debug(`Deleting ${variants.length} ProductVariants`, constants_1.loggerCtx);
        let operations = [];
        for (const variant of variants) {
            for (const channelId of channelIds) {
                for (const languageCode of languageVariants) {
                    operations.push({
                        index: constants_1.VARIANT_INDEX_NAME,
                        operation: {
                            delete: {
                                _id: ElasticsearchIndexerController_1.getId(variant.id, channelId, languageCode),
                            },
                        },
                    });
                    if (operations.length >= this.options.reindexBulkOperationSizeLimit) {
                        // Because we can have a huge amount of variant for 1 product, we also chunk update operations
                        await this.executeBulkOperationsByChunks(this.options.reindexBulkOperationSizeLimit, operations, index);
                        operations = [];
                    }
                }
            }
        }
        // Because we can have a huge amount of variant for 1 product, we also chunk update operations
        await this.executeBulkOperationsByChunks(this.options.reindexBulkOperationSizeLimit, operations, index);
        return;
    }
    async getProductIdsByVariantIds(variantIds) {
        const variants = await this.connection.getRepository(core_2.ProductVariant).find({
            where: { id: (0, typeorm_1.In)(variantIds) },
            relations: ['product'],
            loadEagerRelations: false,
        });
        return (0, unique_1.unique)(variants.map(v => v.product.id));
    }
    async executeBulkOperations(operations, indexName = constants_1.VARIANT_INDEX_NAME) {
        const variantOperations = [];
        for (const operation of operations) {
            variantOperations.push(operation.operation);
        }
        return Promise.all([this.runBulkOperationsOnIndex(indexName, variantOperations)]);
    }
    async runBulkOperationsOnIndex(indexName, operations) {
        var _a;
        if (operations.length === 0) {
            return;
        }
        try {
            const fullIndexName = this.options.indexPrefix + indexName;
            const { body } = await this.client.bulk({
                refresh: true,
                index: fullIndexName,
                body: operations,
            });
            if (body.errors) {
                core_2.Logger.error(`Some errors occurred running bulk operations on ${fullIndexName}! Set logger to "debug" to print all errors.`, constants_1.loggerCtx);
                body.items.forEach(item => {
                    if (item.index) {
                        core_2.Logger.debug(JSON.stringify(item.index.error, null, 2), constants_1.loggerCtx);
                    }
                    if (item.update) {
                        core_2.Logger.debug(JSON.stringify(item.update.error, null, 2), constants_1.loggerCtx);
                    }
                    if (item.delete) {
                        core_2.Logger.debug(JSON.stringify(item.delete.error, null, 2), constants_1.loggerCtx);
                    }
                });
            }
            else {
                core_2.Logger.debug(`Executed ${body.items.length} bulk operations on index [${fullIndexName}]`, constants_1.loggerCtx);
            }
            return body;
        }
        catch (e) {
            core_2.Logger.error(`Error when attempting to run bulk operations [${JSON.stringify(e)}]`, constants_1.loggerCtx);
            core_2.Logger.error('Error details: ' + JSON.stringify((_a = e.body) === null || _a === void 0 ? void 0 : _a.error, null, 2), constants_1.loggerCtx);
        }
    }
    async createVariantIndexItem(v, variants, ctx, languageCode) {
        try {
            const productAsset = v.product.featuredAsset;
            const variantAsset = v.featuredAsset;
            const productTranslation = this.getTranslation(v.product, languageCode);
            const variantTranslation = this.getTranslation(v, languageCode);
            const collectionTranslations = v.collections.map(c => this.getTranslation(c, languageCode));
            const productCollectionTranslations = variants.reduce((translations, variant) => [
                ...translations,
                ...variant.collections.map(c => this.getTranslation(c, languageCode)),
            ], []);
            const prices = variants.map(variant => variant.price);
            const pricesWithTax = variants.map(variant => variant.priceWithTax);
            const item = {
                channelId: ctx.channelId,
                languageCode,
                productVariantId: v.id,
                sku: v.sku,
                slug: productTranslation.slug,
                productId: v.product.id,
                productName: productTranslation.name,
                productAssetId: productAsset ? productAsset.id : undefined,
                productPreview: productAsset ? productAsset.preview : '',
                productPreviewFocalPoint: productAsset ? productAsset.focalPoint || undefined : undefined,
                productVariantName: variantTranslation.name,
                productVariantAssetId: variantAsset ? variantAsset.id : undefined,
                productVariantPreview: variantAsset ? variantAsset.preview : '',
                productVariantPreviewFocalPoint: variantAsset
                    ? variantAsset.focalPoint || undefined
                    : undefined,
                price: v.price,
                priceWithTax: v.priceWithTax,
                currencyCode: v.currencyCode,
                description: productTranslation.description,
                facetIds: this.getFacetIds([v]),
                channelIds: v.channels.map(c => c.id),
                facetValueIds: this.getFacetValueIds([v]),
                collectionIds: v.collections.map(c => c.id.toString()),
                collectionSlugs: collectionTranslations.map(c => c.slug),
                enabled: v.enabled && v.product.enabled,
                productEnabled: variants.some(variant => variant.enabled) && v.product.enabled,
                productPriceMin: Math.min(...prices),
                productPriceMax: Math.max(...prices),
                productPriceWithTaxMin: Math.min(...pricesWithTax),
                productPriceWithTaxMax: Math.max(...pricesWithTax),
                productFacetIds: this.getFacetIds(variants),
                productFacetValueIds: this.getFacetValueIds(variants),
                productCollectionIds: (0, unique_1.unique)(variants.reduce((ids, variant) => [...ids, ...variant.collections.map(c => c.id)], [])),
                productCollectionSlugs: (0, unique_1.unique)(productCollectionTranslations.map(c => c.slug)),
                productChannelIds: v.product.channels.map(c => c.id),
                inStock: 0 < (await this.productVariantService.getSaleableStockLevel(ctx, v)),
                productInStock: await this.getProductInStockValue(ctx, variants),
            };
            const variantCustomMappings = Object.entries(this.options.customProductVariantMappings);
            for (const [name, def] of variantCustomMappings) {
                item[`variant-${name}`] = await def.valueFn(v, languageCode, this.injector, ctx);
            }
            const productCustomMappings = Object.entries(this.options.customProductMappings);
            for (const [name, def] of productCustomMappings) {
                item[`product-${name}`] = await def.valueFn(v.product, variants, languageCode, this.injector, ctx);
            }
            return item;
        }
        catch (err) {
            core_2.Logger.error(err.toString());
            throw Error('Error while reindexing!');
        }
    }
    async getProductInStockValue(ctx, variants) {
        return this.requestContextCache.get(ctx, `elastic-index-product-in-stock-${variants.map(v => v.id).join(',')}`, async () => {
            const stockLevels = await Promise.all(variants.map(variant => this.productVariantService.getSaleableStockLevel(ctx, variant)));
            return stockLevels.some(stockLevel => 0 < stockLevel);
        });
    }
    /**
     * If a Product has no variants, we create a synthetic variant for the purposes
     * of making that product visible via the search query.
     */
    async createSyntheticProductIndexItem(product, ctx, languageCode) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const productTranslation = this.getTranslation(product, languageCode);
        const productAsset = product.featuredAsset;
        const item = {
            channelId: ctx.channelId,
            languageCode,
            productVariantId: 0,
            sku: '',
            slug: productTranslation.slug,
            productId: product.id,
            productName: productTranslation.name,
            productAssetId: productAsset ? productAsset.id : undefined,
            productPreview: productAsset ? productAsset.preview : '',
            productPreviewFocalPoint: productAsset ? productAsset.focalPoint || undefined : undefined,
            productVariantName: productTranslation.name,
            productVariantAssetId: undefined,
            productVariantPreview: '',
            productVariantPreviewFocalPoint: undefined,
            price: 0,
            priceWithTax: 0,
            currencyCode: ctx.currencyCode,
            description: productTranslation.description,
            facetIds: (_b = (_a = product.facetValues) === null || _a === void 0 ? void 0 : _a.map(fv => fv.facet.id.toString())) !== null && _b !== void 0 ? _b : [],
            channelIds: [ctx.channelId],
            facetValueIds: (_d = (_c = product.facetValues) === null || _c === void 0 ? void 0 : _c.map(fv => fv.id.toString())) !== null && _d !== void 0 ? _d : [],
            collectionIds: [],
            collectionSlugs: [],
            enabled: false,
            productEnabled: false,
            productPriceMin: 0,
            productPriceMax: 0,
            productPriceWithTaxMin: 0,
            productPriceWithTaxMax: 0,
            productFacetIds: (_f = (_e = product.facetValues) === null || _e === void 0 ? void 0 : _e.map(fv => fv.facet.id.toString())) !== null && _f !== void 0 ? _f : [],
            productFacetValueIds: (_h = (_g = product.facetValues) === null || _g === void 0 ? void 0 : _g.map(fv => fv.id.toString())) !== null && _h !== void 0 ? _h : [],
            productCollectionIds: [],
            productCollectionSlugs: [],
            productChannelIds: product.channels.map(c => c.id),
            inStock: false,
            productInStock: false,
        };
        const productCustomMappings = Object.entries(this.options.customProductMappings);
        for (const [name, def] of productCustomMappings) {
            item[`product-${name}`] = await def.valueFn(product, [], languageCode, this.injector, ctx);
        }
        return item;
    }
    getTranslation(translatable, languageCode) {
        return (translatable.translations.find(t => t.languageCode === languageCode) ||
            translatable.translations.find(t => t.languageCode === this.configService.defaultLanguageCode) ||
            translatable.translations[0]);
    }
    getFacetIds(variants) {
        const facetIds = (fv) => fv.facet.id.toString();
        const variantFacetIds = variants.reduce((ids, v) => [...ids, ...v.facetValues.map(facetIds)], []);
        const productFacetIds = variants[0].product.facetValues.map(facetIds);
        return (0, unique_1.unique)([...variantFacetIds, ...productFacetIds]);
    }
    getFacetValueIds(variants) {
        const facetValueIds = (fv) => fv.id.toString();
        const variantFacetValueIds = variants.reduce((ids, v) => [...ids, ...v.facetValues.map(facetValueIds)], []);
        const productFacetValueIds = variants[0].product.facetValues.map(facetValueIds);
        return (0, unique_1.unique)([...variantFacetValueIds, ...productFacetValueIds]);
    }
    static getId(entityId, channelId, languageCode) {
        return `${channelId.toString()}_${entityId.toString()}_${languageCode}`;
    }
};
exports.ElasticsearchIndexerController = ElasticsearchIndexerController;
exports.ElasticsearchIndexerController = ElasticsearchIndexerController = ElasticsearchIndexerController_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(constants_1.ELASTIC_SEARCH_OPTIONS)),
    __metadata("design:paramtypes", [core_2.TransactionalConnection, Object, core_2.ProductPriceApplicator,
        core_2.ConfigService,
        core_2.ProductVariantService,
        core_2.RequestContextCacheService,
        core_1.ModuleRef])
], ElasticsearchIndexerController);
//# sourceMappingURL=indexer.controller.js.map