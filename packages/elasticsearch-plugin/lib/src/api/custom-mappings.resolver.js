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
exports.CustomMappingsResolver = void 0;
const common_1 = require("@nestjs/common");
const graphql_1 = require("@nestjs/graphql");
const constants_1 = require("../constants");
/**
 * This resolver is only required if both customProductMappings and customProductVariantMappings are
 * defined, since this particular configuration will result in a union type for the
 * `SearchResult.customMappings` GraphQL field.
 */
let CustomMappingsResolver = class CustomMappingsResolver {
    constructor(options) {
        this.options = options;
    }
    __resolveType(value) {
        const productPropertyNames = Object.keys(this.options.customProductMappings);
        return Object.keys(value).every(k => productPropertyNames.includes(k))
            ? 'CustomProductMappings'
            : 'CustomProductVariantMappings';
    }
};
exports.CustomMappingsResolver = CustomMappingsResolver;
__decorate([
    (0, graphql_1.ResolveField)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", String)
], CustomMappingsResolver.prototype, "__resolveType", null);
exports.CustomMappingsResolver = CustomMappingsResolver = __decorate([
    (0, graphql_1.Resolver)('CustomMappings'),
    __param(0, (0, common_1.Inject)(constants_1.ELASTIC_SEARCH_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], CustomMappingsResolver);
//# sourceMappingURL=custom-mappings.resolver.js.map