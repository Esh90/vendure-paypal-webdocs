import { OnApplicationBootstrap } from '@nestjs/common';
import { Asset, ID, JobQueueService, Product, ProductVariant, RequestContext } from '@vendure/core';
import { UpdateIndexQueueJobData } from '../types';
import { ElasticsearchIndexerController } from './indexer.controller';
export declare class ElasticsearchIndexService implements OnApplicationBootstrap {
    private jobService;
    private indexerController;
    private updateIndexQueue;
    constructor(jobService: JobQueueService, indexerController: ElasticsearchIndexerController);
    onApplicationBootstrap(): Promise<void>;
    reindex(ctx: RequestContext): Promise<import("@vendure/core/dist/job-queue/subscribable-job").SubscribableJob<UpdateIndexQueueJobData>>;
    updateProduct(ctx: RequestContext, product: Product): Promise<import("@vendure/core/dist/job-queue/subscribable-job").SubscribableJob<UpdateIndexQueueJobData>>;
    updateVariants(ctx: RequestContext, variants: ProductVariant[]): Promise<import("@vendure/core/dist/job-queue/subscribable-job").SubscribableJob<UpdateIndexQueueJobData>>;
    deleteProduct(ctx: RequestContext, product: Product): Promise<import("@vendure/core/dist/job-queue/subscribable-job").SubscribableJob<UpdateIndexQueueJobData>>;
    deleteVariant(ctx: RequestContext, variants: ProductVariant[]): Promise<import("@vendure/core/dist/job-queue/subscribable-job").SubscribableJob<UpdateIndexQueueJobData>>;
    assignProductToChannel(ctx: RequestContext, product: Product, channelId: ID): Promise<import("@vendure/core/dist/job-queue/subscribable-job").SubscribableJob<UpdateIndexQueueJobData>>;
    removeProductFromChannel(ctx: RequestContext, product: Product, channelId: ID): Promise<import("@vendure/core/dist/job-queue/subscribable-job").SubscribableJob<UpdateIndexQueueJobData>>;
    assignVariantToChannel(ctx: RequestContext, productVariantId: ID, channelId: ID): Promise<import("@vendure/core/dist/job-queue/subscribable-job").SubscribableJob<UpdateIndexQueueJobData>>;
    removeVariantFromChannel(ctx: RequestContext, productVariantId: ID, channelId: ID): Promise<import("@vendure/core/dist/job-queue/subscribable-job").SubscribableJob<UpdateIndexQueueJobData>>;
    updateVariantsById(ctx: RequestContext, ids: ID[]): Promise<import("@vendure/core/dist/job-queue/subscribable-job").SubscribableJob<UpdateIndexQueueJobData>>;
    updateAsset(ctx: RequestContext, asset: Asset): Promise<import("@vendure/core/dist/job-queue/subscribable-job").SubscribableJob<UpdateIndexQueueJobData>>;
    deleteAsset(ctx: RequestContext, asset: Asset): Promise<import("@vendure/core/dist/job-queue/subscribable-job").SubscribableJob<UpdateIndexQueueJobData>>;
    private jobWithProgress;
}
