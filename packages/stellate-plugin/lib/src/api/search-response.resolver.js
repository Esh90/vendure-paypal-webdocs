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
exports.SearchResponseFieldResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
let SearchResponseFieldResolver = class SearchResponseFieldResolver {
    cacheIdentifier(info) {
        var _a;
        const collectionSlug = (_a = info.variableValues.input) === null || _a === void 0 ? void 0 : _a.collectionSlug;
        return { collectionSlug };
    }
};
exports.SearchResponseFieldResolver = SearchResponseFieldResolver;
__decorate([
    (0, graphql_1.ResolveField)(),
    __param(0, (0, graphql_1.Info)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SearchResponseFieldResolver.prototype, "cacheIdentifier", null);
exports.SearchResponseFieldResolver = SearchResponseFieldResolver = __decorate([
    (0, graphql_1.Resolver)('SearchResponse')
], SearchResponseFieldResolver);
//# sourceMappingURL=search-response.resolver.js.map