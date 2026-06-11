import { LanguageCode } from '@vendure/common/lib/generated-types';
import { DeepRequired, ID, RequestContext } from '@vendure/core';
import { SearchConfig } from './options';
import { ElasticSearchInput, SearchRequestBody } from './types';
/**
 * Given a SearchInput object, returns the corresponding Elasticsearch body.
 */
export declare function buildElasticBody(input: ElasticSearchInput, searchConfig: DeepRequired<SearchConfig>, channelId: ID, languageCode: LanguageCode, enabledOnly: boolean | undefined, ctx: RequestContext): SearchRequestBody;
