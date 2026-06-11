import { Job as GraphQLJob, QuerySearchArgs, SearchResponse } from '@vendure/common/lib/generated-types';
import { Omit } from '@vendure/common/lib/omit';
import { Collection, FacetValue, RequestContext, SearchJobBufferService, SearchResolver } from '@vendure/core';
import { ElasticsearchService } from '../elasticsearch.service';
import { ElasticSearchInput, SearchPriceData } from '../types';
export declare class ShopElasticSearchResolver implements Pick<SearchResolver, 'search'> {
    private elasticsearchService;
    constructor(elasticsearchService: ElasticsearchService);
    search(ctx: RequestContext, args: QuerySearchArgs): Promise<Omit<SearchResponse, 'facetValues' | 'collections'>>;
    prices(ctx: RequestContext, parent: {
        input: ElasticSearchInput;
    }): Promise<SearchPriceData>;
}
export declare class AdminElasticSearchResolver implements Pick<SearchResolver, 'search' | 'reindex'> {
    private elasticsearchService;
    private searchJobBufferService;
    constructor(elasticsearchService: ElasticsearchService, searchJobBufferService: SearchJobBufferService);
    search(ctx: RequestContext, args: QuerySearchArgs): Promise<Omit<SearchResponse, 'facetValues' | 'collections'>>;
    reindex(ctx: RequestContext): Promise<GraphQLJob>;
    pendingSearchIndexUpdates(...args: any[]): Promise<any>;
    runPendingSearchIndexUpdates(...args: any[]): Promise<any>;
}
export declare class EntityElasticSearchResolver implements Pick<SearchResolver, 'facetValues' | 'collections'> {
    private elasticsearchService;
    constructor(elasticsearchService: ElasticsearchService);
    facetValues(ctx: RequestContext, parent: Omit<SearchResponse, 'facetValues' | 'collections'>): Promise<Array<{
        facetValue: FacetValue;
        count: number;
    }>>;
    collections(ctx: RequestContext, parent: Omit<SearchResponse, 'facetValues' | 'collections'>): Promise<Array<{
        collection: Collection;
        count: number;
    }>>;
}
