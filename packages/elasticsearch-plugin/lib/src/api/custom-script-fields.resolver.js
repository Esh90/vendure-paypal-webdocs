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
exports.CustomScriptFieldsResolver = void 0;
const common_1 = require("@nestjs/common");
const graphql_1 = require("@nestjs/graphql");
const constants_1 = require("../constants");
/**
 * This resolver is only required if scriptFields are defined for both products and product variants.
 * This particular configuration will result in a union type for the
 * `SearchResult.customScriptFields` GraphQL field.
 */
let CustomScriptFieldsResolver = class CustomScriptFieldsResolver {
    constructor(options) {
        this.options = options;
    }
    __resolveType(value) {
        var _a;
        const productScriptFields = Object.entries(((_a = this.options.searchConfig) === null || _a === void 0 ? void 0 : _a.scriptFields) || {})
            .filter(([, scriptField]) => scriptField.context !== 'variant')
            .map(([k]) => k);
        return Object.keys(value).every(k => productScriptFields.includes(k))
            ? 'CustomProductScriptFields'
            : 'CustomProductVariantScriptFields';
    }
};
exports.CustomScriptFieldsResolver = CustomScriptFieldsResolver;
__decorate([
    (0, graphql_1.ResolveField)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", String)
], CustomScriptFieldsResolver.prototype, "__resolveType", null);
exports.CustomScriptFieldsResolver = CustomScriptFieldsResolver = __decorate([
    (0, graphql_1.Resolver)('CustomScriptFields'),
    __param(0, (0, common_1.Inject)(constants_1.ELASTIC_SEARCH_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], CustomScriptFieldsResolver);
//# sourceMappingURL=custom-script-fields.resolver.js.map