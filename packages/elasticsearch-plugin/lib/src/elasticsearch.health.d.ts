import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { ElasticsearchService } from './elasticsearch.service';
export declare class ElasticsearchHealthIndicator extends HealthIndicator {
    private elasticsearchService;
    constructor(elasticsearchService: ElasticsearchService);
    isHealthy(): Promise<HealthIndicatorResult>;
    startupCheckFailed(message: string): never;
    private throwHealthCheckError;
}
