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
exports.ElasticsearchHealthIndicator = void 0;
const common_1 = require("@nestjs/common");
const terminus_1 = require("@nestjs/terminus");
const elasticsearch_service_1 = require("./elasticsearch.service");
let ElasticsearchHealthIndicator = class ElasticsearchHealthIndicator extends terminus_1.HealthIndicator {
    constructor(elasticsearchService) {
        super();
        this.elasticsearchService = elasticsearchService;
    }
    async isHealthy() {
        let isHealthy = false;
        let error = '';
        try {
            await this.elasticsearchService.checkConnection();
            isHealthy = true;
        }
        catch (e) {
            error = e.message;
        }
        const result = this.getStatus('elasticsearch', isHealthy, { message: error });
        if (isHealthy) {
            return result;
        }
        this.throwHealthCheckError(result);
    }
    startupCheckFailed(message) {
        const result = this.getStatus('elasticsearch', false, { message });
        return this.throwHealthCheckError(result);
    }
    throwHealthCheckError(result) {
        throw new terminus_1.HealthCheckError('Elasticsearch not available', result);
    }
};
exports.ElasticsearchHealthIndicator = ElasticsearchHealthIndicator;
exports.ElasticsearchHealthIndicator = ElasticsearchHealthIndicator = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [elasticsearch_service_1.ElasticsearchService])
], ElasticsearchHealthIndicator);
//# sourceMappingURL=elasticsearch.health.js.map