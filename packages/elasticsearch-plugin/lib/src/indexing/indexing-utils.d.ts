import { Client } from '@elastic/elasticsearch';
import { DeepRequired, ID } from '@vendure/core';
import { ElasticsearchOptions } from '../options';
export declare function createIndices(client: Client, prefix: string, indexSettings: object, indexMappingProperties: object, mapAlias?: boolean, aliasPostfix?: string): Promise<void>;
export declare function deleteIndices(client: Client, prefix: string): Promise<void>;
export declare function deleteByChannel(client: Client, prefix: string, channelId: ID): Promise<void>;
export declare function getClient(options: Required<ElasticsearchOptions> | DeepRequired<ElasticsearchOptions>): Client;
export declare function getIndexNameByAlias(client: Client, aliasName: string): Promise<string>;
