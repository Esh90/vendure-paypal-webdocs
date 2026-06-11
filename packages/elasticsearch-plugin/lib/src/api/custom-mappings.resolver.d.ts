import { DeepRequired } from '@vendure/common/lib/shared-types';
import { ElasticsearchOptions } from '../options';
/**
 * This resolver is only required if both customProductMappings and customProductVariantMappings are
 * defined, since this particular configuration will result in a union type for the
 * `SearchResult.customMappings` GraphQL field.
 */
export declare class CustomMappingsResolver {
    private options;
    constructor(options: DeepRequired<ElasticsearchOptions>);
    __resolveType(value: any): string;
}
