import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService, EntityRelationPaths, Product, ProductPriceApplicator, ProductVariant, ProductVariantService, RequestContextCacheService, TransactionalConnection } from '@vendure/core';
import { Observable } from 'rxjs';
import { VARIANT_INDEX_NAME } from '../constants';
import { ElasticsearchOptions } from '../options';
import { BulkOperation, BulkOperationDoc, ProductChannelMessageData, ReindexMessageData, UpdateAssetMessageData, UpdateProductMessageData, UpdateVariantMessageData, UpdateVariantsByIdMessageData, VariantChannelMessageData, VariantIndexItem } from '../types';
export declare const defaultProductRelations: Array<EntityRelationPaths<Product>>;
export declare const defaultVariantRelations: Array<EntityRelationPaths<ProductVariant>>;
export interface ReindexMessageResponse {
    total: number;
    completed: number;
    duration: number;
}
type BulkVariantOperation = {
    index: typeof VARIANT_INDEX_NAME;
    operation: BulkOperation | BulkOperationDoc<VariantIndexItem>;
};
export declare class ElasticsearchIndexerController implements OnModuleInit, OnModuleDestroy {
    private connection;
    private options;
    private productPriceApplicator;
    private configService;
    private productVariantService;
    private requestContextCache;
    private moduleRef;
    private client;
    private asyncQueue;
    private productRelations;
    private variantRelations;
    private injector;
    constructor(connection: TransactionalConnection, options: Required<ElasticsearchOptions>, productPriceApplicator: ProductPriceApplicator, configService: ConfigService, productVariantService: ProductVariantService, requestContextCache: RequestContextCacheService, moduleRef: ModuleRef);
    onModuleInit(): any;
    onModuleDestroy(): any;
    /**
     * Updates the search index only for the affected product.
     */
    updateProduct({ ctx: rawContext, productId }: UpdateProductMessageData): Promise<boolean>;
    /**
     * Updates the search index only for the affected product.
     */
    deleteProduct({ ctx: rawContext, productId }: UpdateProductMessageData): Promise<boolean>;
    /**
     * Updates the search index only for the affected product.
     */
    assignProductToChannel({ ctx: rawContext, productId, channelId, }: ProductChannelMessageData): Promise<boolean>;
    /**
     * Updates the search index only for the affected product.
     */
    removeProductFromChannel({ ctx: rawContext, productId, channelId, }: ProductChannelMessageData): Promise<boolean>;
    assignVariantToChannel({ ctx: rawContext, productVariantId, channelId, }: VariantChannelMessageData): Promise<boolean>;
    removeVariantFromChannel({ ctx: rawContext, productVariantId, channelId, }: VariantChannelMessageData): Promise<boolean>;
    /**
     * Updates the search index only for the affected entities.
     */
    updateVariants({ ctx: rawContext, variantIds }: UpdateVariantMessageData): Promise<boolean>;
    deleteVariants({ ctx: rawContext, variantIds }: UpdateVariantMessageData): Promise<boolean>;
    updateVariantsById({ ctx: rawContext, ids, }: UpdateVariantsByIdMessageData): Observable<ReindexMessageResponse>;
    reindex({ ctx: rawContext }: ReindexMessageData): Observable<ReindexMessageResponse>;
    executeBulkOperationsByChunks(chunkSize: number, operations: BulkVariantOperation[], index?: string): Promise<void>;
    updateAsset(data: UpdateAssetMessageData): Promise<boolean>;
    deleteAsset(data: UpdateAssetMessageData): Promise<boolean>;
    private updateAssetFocalPointForIndex;
    private deleteAssetForIndex;
    private updateAssetForIndex;
    private updateProductsInternal;
    private switchAlias;
    private updateProductsOperationsOnly;
    private updateProductsOperations;
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
    private getReindexRelations;
    private deleteProductOperations;
    private deleteVariantsInternalOperations;
    private getProductIdsByVariantIds;
    private executeBulkOperations;
    private runBulkOperationsOnIndex;
    private createVariantIndexItem;
    private getProductInStockValue;
    /**
     * If a Product has no variants, we create a synthetic variant for the purposes
     * of making that product visible via the search query.
     */
    private createSyntheticProductIndexItem;
    private getTranslation;
    private getFacetIds;
    private getFacetValueIds;
    private static getId;
}
export {};
