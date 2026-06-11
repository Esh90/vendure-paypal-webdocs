import { DeepRequired } from '@vendure/common/lib/shared-types';
import { ElasticsearchOptions } from '../options';
/**
 * This resolver is only required if scriptFields are defined for both products and product variants.
 * This particular configuration will result in a union type for the
 * `SearchResult.customScriptFields` GraphQL field.
 */
export declare class CustomScriptFieldsResolver {
    private options;
    constructor(options: DeepRequired<ElasticsearchOptions>);
    __resolveType(value: any): string;
}
