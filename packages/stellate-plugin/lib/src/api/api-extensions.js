"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shopApiExtensions = void 0;
const graphql_tag_1 = __importDefault(require("graphql-tag"));
exports.shopApiExtensions = (0, graphql_tag_1.default) `
    """
    This type is here to allow us to easily purge the Stellate cache
    of any search results where the collectionSlug is used. We cannot rely on
    simply purging the SearchResult type, because in the case of an empty 'items'
    array, Stellate cannot know that that particular query now needs to be purged.
    """
    type SearchResponseCacheIdentifier {
        collectionSlug: String
    }

    extend type SearchResponse {
        cacheIdentifier: SearchResponseCacheIdentifier
    }
`;
//# sourceMappingURL=api-extensions.js.map