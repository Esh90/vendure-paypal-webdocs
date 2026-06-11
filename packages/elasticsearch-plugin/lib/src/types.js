"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElasticSearchSortMode = void 0;
var ElasticSearchSortMode;
(function (ElasticSearchSortMode) {
    /** Pick the lowest value */
    ElasticSearchSortMode["MIN"] = "min";
    /** Pick the highest value */
    ElasticSearchSortMode["MAX"] = "max";
    /** Use the sum of all values as sort value. Only applicable for number based array fields */
    ElasticSearchSortMode["SUM"] = "sum";
    /** Use the average of all values as sort value. Only applicable for number based array fields */
    ElasticSearchSortMode["AVG"] = "avg";
    /** Use the median of all values as sort value. Only applicable for number based array fields */
    ElasticSearchSortMode["MEDIAN"] = "median";
})(ElasticSearchSortMode || (exports.ElasticSearchSortMode = ElasticSearchSortMode = {}));
//# sourceMappingURL=types.js.map