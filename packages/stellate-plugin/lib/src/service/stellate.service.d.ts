import { Collection, ID, Product, ProductVariant } from '@vendure/core';
import { StellatePluginOptions } from '../types';
type CachedType = 'Product' | 'ProductVariant' | 'Collection' | 'SearchResponse' | 'SearchResult' | 'SearchResponseCacheIdentifier' | string;
/**
 * @description
 * The StellateService is used to purge the Stellate cache when certain events occur.
 *
 * @docsCategory core plugins/StellatePlugin
 */
export declare class StellateService {
    private options;
    private readonly purgeApiUrl;
    constructor(options: StellatePluginOptions);
    /**
     * @description
     * Purges the cache for the given Products.
     */
    purgeProducts(products: Product[]): Promise<void>;
    /**
     * @description
     * Purges the cache for the given ProductVariants.
     */
    purgeProductVariants(productVariants: ProductVariant[]): Promise<void>;
    /**
     * @description
     * Purges the cache for SearchResults which contain the given Products or ProductVariants.
     */
    purgeSearchResults(items: Array<ProductVariant | Product>): Promise<void>;
    /**
     * @description
     * Purges the entire cache for the given type.
     */
    purgeAllOfType(type: CachedType): Promise<void>;
    /**
     * @description
     * Purges the cache for the given Collections.
     */
    purgeCollections(collections: Collection[]): Promise<void>;
    /**
     * @description
     * Purges the cache of SearchResults for the given Collections based on slug.
     */
    purgeSearchResponseCacheIdentifiers(collections: Collection[]): Promise<void>;
    /**
     * @description
     * Purges the cache for the given type and keys.
     */
    purge(type: CachedType, keys?: ID[], keyName?: string): Promise<void> | undefined;
}
export {};
