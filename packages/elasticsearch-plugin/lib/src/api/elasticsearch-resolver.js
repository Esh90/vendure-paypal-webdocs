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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityElasticSearchResolver = exports.AdminElasticSearchResolver = exports.ShopElasticSearchResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const generated_types_1 = require("@vendure/common/lib/generated-types");
const core_1 = require("@vendure/core");
const elasticsearch_service_1 = require("../elasticsearch.service");
let ShopElasticSearchResolver = class ShopElasticSearchResolver {
    constructor(elasticsearchService) {
        this.elasticsearchService = elasticsearchService;
    }
    async search(ctx, args) {
        const result = await this.elasticsearchService.search(ctx, args.input, true);
        // ensure the facetValues property resolver has access to the input args
        result.input = args.input;
        return result;
    }
    async prices(ctx, parent) {
        return this.elasticsearchService.priceRange(ctx, parent.input);
    }
};
exports.ShopElasticSearchResolver = ShopElasticSearchResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(generated_types_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ShopElasticSearchResolver.prototype, "search", null);
__decorate([
    (0, graphql_1.ResolveField)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ShopElasticSearchResolver.prototype, "prices", null);
exports.ShopElasticSearchResolver = ShopElasticSearchResolver = __decorate([
    (0, graphql_1.Resolver)('SearchResponse'),
    __metadata("design:paramtypes", [elasticsearch_service_1.ElasticsearchService])
], ShopElasticSearchResolver);
let AdminElasticSearchResolver = class AdminElasticSearchResolver {
    constructor(elasticsearchService, searchJobBufferService) {
        this.elasticsearchService = elasticsearchService;
        this.searchJobBufferService = searchJobBufferService;
    }
    async search(ctx, args) {
        const result = await this.elasticsearchService.search(ctx, args.input, false);
        // ensure the facetValues property resolver has access to the input args
        result.input = args.input;
        return result;
    }
    async reindex(ctx) {
        return this.elasticsearchService.reindex(ctx);
    }
    async pendingSearchIndexUpdates(...args) {
        return this.searchJobBufferService.getPendingSearchUpdates();
    }
    async runPendingSearchIndexUpdates(...args) {
        // Intentionally not awaiting this method call
        void this.searchJobBufferService.runPendingSearchUpdates();
        return { success: true };
    }
};
exports.AdminElasticSearchResolver = AdminElasticSearchResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(generated_types_1.Permission.ReadCatalog, generated_types_1.Permission.ReadProduct),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], AdminElasticSearchResolver.prototype, "search", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(generated_types_1.Permission.UpdateCatalog, generated_types_1.Permission.UpdateProduct),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], AdminElasticSearchResolver.prototype, "reindex", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(generated_types_1.Permission.ReadCatalog, generated_types_1.Permission.ReadProduct),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminElasticSearchResolver.prototype, "pendingSearchIndexUpdates", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(generated_types_1.Permission.UpdateCatalog, generated_types_1.Permission.UpdateProduct),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminElasticSearchResolver.prototype, "runPendingSearchIndexUpdates", null);
exports.AdminElasticSearchResolver = AdminElasticSearchResolver = __decorate([
    (0, graphql_1.Resolver)('SearchResponse'),
    __metadata("design:paramtypes", [elasticsearch_service_1.ElasticsearchService,
        core_1.SearchJobBufferService])
], AdminElasticSearchResolver);
let EntityElasticSearchResolver = class EntityElasticSearchResolver {
    constructor(elasticsearchService) {
        this.elasticsearchService = elasticsearchService;
    }
    async facetValues(ctx, parent) {
        const facetValues = await this.elasticsearchService.facetValues(ctx, parent.input, true);
        return facetValues.filter(i => !i.facetValue.facet.isPrivate);
    }
    async collections(ctx, parent) {
        const collections = await this.elasticsearchService.collections(ctx, parent.input, true);
        return collections.filter(i => !i.collection.isPrivate);
    }
};
exports.EntityElasticSearchResolver = EntityElasticSearchResolver;
__decorate([
    (0, graphql_1.ResolveField)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], EntityElasticSearchResolver.prototype, "facetValues", null);
__decorate([
    (0, graphql_1.ResolveField)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], EntityElasticSearchResolver.prototype, "collections", null);
exports.EntityElasticSearchResolver = EntityElasticSearchResolver = __decorate([
    (0, graphql_1.Resolver)('SearchResponse'),
    __metadata("design:paramtypes", [elasticsearch_service_1.ElasticsearchService])
], EntityElasticSearchResolver);
//# sourceMappingURL=elasticsearch-resolver.js.map