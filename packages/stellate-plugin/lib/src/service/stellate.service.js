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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StellateService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const node_fetch_1 = __importDefault(require("node-fetch"));
const constants_1 = require("../constants");
/**
 * @description
 * The StellateService is used to purge the Stellate cache when certain events occur.
 *
 * @docsCategory core plugins/StellatePlugin
 */
let StellateService = class StellateService {
    constructor(options) {
        this.options = options;
        this.purgeApiUrl = `https://admin.stellate.co/${options.serviceName}`;
    }
    /**
     * @description
     * Purges the cache for the given Products.
     */
    async purgeProducts(products) {
        core_1.Logger.verbose(`Purging cache: Product(${products.map(p => p.id).join(', ')})`, constants_1.loggerCtx);
        await this.purge('Product', products.map(p => p.id));
    }
    /**
     * @description
     * Purges the cache for the given ProductVariants.
     */
    async purgeProductVariants(productVariants) {
        core_1.Logger.verbose(`Purging cache: ProductVariant(${productVariants.map(p => p.id).join(', ')})`, constants_1.loggerCtx);
        await this.purge('ProductVariant', productVariants.map(p => p.id));
    }
    /**
     * @description
     * Purges the cache for SearchResults which contain the given Products or ProductVariants.
     */
    async purgeSearchResults(items) {
        const productIds = items.map(item => (item instanceof core_1.Product ? item.id : item.productId));
        core_1.Logger.verbose(`Purging cache: SearchResult(${productIds.join(', ')})`, constants_1.loggerCtx);
        await this.purge('SearchResult', productIds, 'productId');
    }
    /**
     * @description
     * Purges the entire cache for the given type.
     */
    async purgeAllOfType(type) {
        core_1.Logger.verbose(`Purging cache: All ${type}s`, constants_1.loggerCtx);
        await this.purge(type);
    }
    /**
     * @description
     * Purges the cache for the given Collections.
     */
    async purgeCollections(collections) {
        core_1.Logger.verbose(`Purging cache: Collection(${collections.map(c => c.id).join(', ')})`, constants_1.loggerCtx);
        await this.purge('Collection', collections.map(p => p.id));
    }
    /**
     * @description
     * Purges the cache of SearchResults for the given Collections based on slug.
     */
    async purgeSearchResponseCacheIdentifiers(collections) {
        const slugs = collections.map(c => { var _a, _b, _c; return (_a = c.slug) !== null && _a !== void 0 ? _a : (_c = (_b = c.translations) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.slug; });
        if (slugs.length) {
            core_1.Logger.verbose(`Purging cache: SearchResponseCacheIdentifier(${slugs.join(', ')})`, constants_1.loggerCtx);
            await this.purge('SearchResponseCacheIdentifier', slugs);
        }
    }
    /**
     * @description
     * Purges the cache for the given type and keys.
     */
    purge(type, keys, keyName = 'id') {
        var _a, _b, _c;
        const payload = {
            query: `
                mutation PurgeType($type: String!, $keyFields: [KeyFieldInput!]) {
                    _purgeType(type: $type, keyFields: $keyFields)
                }
            `,
            variables: {
                type,
                keyFields: keys === null || keys === void 0 ? void 0 : keys.filter(id => !!id).map(id => ({ name: keyName, value: id.toString() })),
            },
        };
        if (this.options.debugLogging === true) {
            const keyFieldsLength = (_b = (_a = payload.variables.keyFields) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
            if (5 < keyFieldsLength) {
                payload.variables.keyFields = (_c = payload.variables.keyFields) === null || _c === void 0 ? void 0 : _c.slice(0, 5);
            }
            core_1.Logger.debug('Purge arguments:\n' + JSON.stringify(payload.variables, null, 2), constants_1.loggerCtx);
            if (5 < keyFieldsLength) {
                core_1.Logger.debug(`(A further ${keyFieldsLength - 5} keyFields truncated)`, constants_1.loggerCtx);
            }
        }
        if (this.options.devMode === true) {
            // no-op
        }
        else {
            return (0, node_fetch_1.default)(this.purgeApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'stellate-token': this.options.apiToken,
                },
                body: JSON.stringify(payload),
                timeout: 5000,
            })
                .then(res => res.json())
                .then(json => {
                var _a, _b, _c;
                if (((_a = json.data) === null || _a === void 0 ? void 0 : _a._purgeType) !== true) {
                    const errors = (_b = json.errors) === null || _b === void 0 ? void 0 : _b.map((e) => e.message);
                    core_1.Logger.error(`Purge failed: ${(_c = errors.join(', ')) !== null && _c !== void 0 ? _c : JSON.stringify(json)}`, constants_1.loggerCtx);
                }
            })
                .catch((err) => {
                core_1.Logger.error(`Purge error: ${err.message}`, constants_1.loggerCtx);
            });
        }
    }
};
exports.StellateService = StellateService;
exports.StellateService = StellateService = __decorate([
    __param(0, (0, common_1.Inject)(constants_1.STELLATE_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], StellateService);
//# sourceMappingURL=stellate.service.js.map