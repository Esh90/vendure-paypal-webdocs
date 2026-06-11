import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Collection, CollectionService, ConfigService, DeepRequired, EventBus, FacetValue, FacetValueService, Job, RequestContext, SearchService } from '@vendure/core';
import { ElasticsearchIndexService } from './indexing/elasticsearch-index.service';
import { ElasticsearchOptions } from './options';
import { ElasticSearchInput, ElasticSearchResponse, SearchPriceData } from './types';
export declare class ElasticsearchService implements OnModuleInit, OnModuleDestroy {
    private options;
    private searchService;
    private elasticsearchIndexService;
    private configService;
    private facetValueService;
    private collectionService;
    private eventBus;
    private client;
    constructor(options: DeepRequired<ElasticsearchOptions>, searchService: SearchService, elasticsearchIndexService: ElasticsearchIndexService, configService: ConfigService, facetValueService: FacetValueService, collectionService: CollectionService, eventBus: EventBus);
    onModuleInit(): any;
    onModuleDestroy(): any;
    checkConnection(): Promise<void>;
    createIndicesIfNotExists(): Promise<void>;
    /**
     * Perform a fulltext search according to the provided input arguments.
     */
    search(ctx: RequestContext, input: ElasticSearchInput, enabledOnly?: boolean): Promise<Omit<ElasticSearchResponse, 'facetValues' | 'collections' | 'priceRange'>>;
    totalHits(ctx: RequestContext, input: ElasticSearchInput, enabledOnly?: boolean): Promise<number>;
    /**
     * Return a list of all FacetValues which appear in the result set.
     */
    facetValues(ctx: RequestContext, input: ElasticSearchInput, enabledOnly?: boolean): Promise<Array<{
        facetValue: FacetValue;
        count: number;
    }>>;
    /**
     * Return a list of all Collections which appear in the result set.
     */
    collections(ctx: RequestContext, input: ElasticSearchInput, enabledOnly?: boolean): Promise<Array<{
        collection: Collection;
        count: number;
    }>>;
    getDistinctBucketsOfField(ctx: RequestContext, input: ElasticSearchInput, enabledOnly: boolean | undefined, field: string, aggregation_max_size: number): Promise<Array<{
        key: string;
        doc_count: number;
        total: {
            value: number;
        };
    }>>;
    priceRange(ctx: RequestContext, input: ElasticSearchInput): Promise<SearchPriceData>;
    /**
     * Rebuilds the full search index.
     */
    reindex(ctx: RequestContext): Promise<Job>;
    private mapVariantToSearchResult;
    private mapProductToSearchResult;
    private getSearchResultAssets;
    private static addCustomMappings;
    private static addScriptMappings;
}
