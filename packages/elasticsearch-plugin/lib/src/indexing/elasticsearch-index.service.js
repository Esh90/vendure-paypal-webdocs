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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElasticsearchIndexService = void 0;
const common_1 = require("@nestjs/common");
const shared_utils_1 = require("@vendure/common/lib/shared-utils");
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
const indexer_controller_1 = require("./indexer.controller");
let ElasticsearchIndexService = class ElasticsearchIndexService {
    constructor(jobService, indexerController) {
        this.jobService = jobService;
        this.indexerController = indexerController;
    }
    async onApplicationBootstrap() {
        this.updateIndexQueue = await this.jobService.createQueue({
            name: 'update-search-index',
            process: job => {
                const data = job.data;
                switch (data.type) {
                    case 'reindex':
                        core_1.Logger.verbose('sending ReindexMessage');
                        return this.jobWithProgress(job, this.indexerController.reindex(data));
                    case 'update-product':
                        return this.indexerController.updateProduct(data);
                    case 'update-variants':
                        return this.indexerController.updateVariants(data);
                    case 'delete-product':
                        return this.indexerController.deleteProduct(data);
                    case 'delete-variant':
                        return this.indexerController.deleteVariants(data);
                    case 'update-variants-by-id':
                        return this.jobWithProgress(job, this.indexerController.updateVariantsById(data));
                    case 'update-asset':
                        return this.indexerController.updateAsset(data);
                    case 'delete-asset':
                        return this.indexerController.deleteAsset(data);
                    case 'assign-product-to-channel':
                        return this.indexerController.assignProductToChannel(data);
                    case 'remove-product-from-channel':
                        return this.indexerController.removeProductFromChannel(data);
                    case 'assign-variant-to-channel':
                        return this.indexerController.assignVariantToChannel(data);
                    case 'remove-variant-from-channel':
                        return this.indexerController.removeVariantFromChannel(data);
                    default:
                        (0, shared_utils_1.assertNever)(data);
                        return Promise.resolve();
                }
            },
        });
    }
    reindex(ctx) {
        return this.updateIndexQueue.add({ type: 'reindex', ctx: ctx.serialize() }, { ctx });
    }
    updateProduct(ctx, product) {
        return this.updateIndexQueue.add({
            type: 'update-product',
            ctx: ctx.serialize(),
            productId: product.id,
        }, { ctx });
    }
    updateVariants(ctx, variants) {
        const variantIds = variants.map(v => v.id);
        return this.updateIndexQueue.add({ type: 'update-variants', ctx: ctx.serialize(), variantIds }, { ctx });
    }
    deleteProduct(ctx, product) {
        return this.updateIndexQueue.add({
            type: 'delete-product',
            ctx: ctx.serialize(),
            productId: product.id,
        }, { ctx });
    }
    deleteVariant(ctx, variants) {
        const variantIds = variants.map(v => v.id);
        return this.updateIndexQueue.add({ type: 'delete-variant', ctx: ctx.serialize(), variantIds }, { ctx });
    }
    assignProductToChannel(ctx, product, channelId) {
        return this.updateIndexQueue.add({
            type: 'assign-product-to-channel',
            ctx: ctx.serialize(),
            productId: product.id,
            channelId,
        }, { ctx });
    }
    removeProductFromChannel(ctx, product, channelId) {
        return this.updateIndexQueue.add({
            type: 'remove-product-from-channel',
            ctx: ctx.serialize(),
            productId: product.id,
            channelId,
        }, { ctx });
    }
    assignVariantToChannel(ctx, productVariantId, channelId) {
        return this.updateIndexQueue.add({
            type: 'assign-variant-to-channel',
            ctx: ctx.serialize(),
            productVariantId,
            channelId,
        }, { ctx });
    }
    removeVariantFromChannel(ctx, productVariantId, channelId) {
        return this.updateIndexQueue.add({
            type: 'remove-variant-from-channel',
            ctx: ctx.serialize(),
            productVariantId,
            channelId,
        }, { ctx });
    }
    updateVariantsById(ctx, ids) {
        return this.updateIndexQueue.add({ type: 'update-variants-by-id', ctx: ctx.serialize(), ids }, { ctx });
    }
    updateAsset(ctx, asset) {
        return this.updateIndexQueue.add({ type: 'update-asset', ctx: ctx.serialize(), asset: asset }, { ctx });
    }
    deleteAsset(ctx, asset) {
        return this.updateIndexQueue.add({ type: 'delete-asset', ctx: ctx.serialize(), asset: asset }, { ctx });
    }
    jobWithProgress(job, ob) {
        return new Promise((resolve, reject) => {
            let total;
            let duration = 0;
            let completed = 0;
            ob.subscribe({
                next: (response) => {
                    if (!total) {
                        total = response.total;
                    }
                    duration = response.duration;
                    completed = response.completed;
                    const progress = total === 0 ? 100 : Math.ceil((completed / total) * 100);
                    job.setProgress(progress);
                },
                complete: () => {
                    resolve({
                        success: true,
                        indexedItemCount: total,
                        timeTaken: duration,
                    });
                },
                error: (err) => {
                    core_1.Logger.error(err.message || JSON.stringify(err), constants_1.loggerCtx, err.stack);
                    reject(err);
                },
            });
        });
    }
};
exports.ElasticsearchIndexService = ElasticsearchIndexService;
exports.ElasticsearchIndexService = ElasticsearchIndexService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.JobQueueService,
        indexer_controller_1.ElasticsearchIndexerController])
], ElasticsearchIndexService);
//# sourceMappingURL=elasticsearch-index.service.js.map