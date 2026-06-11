"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildElasticBody = buildElasticBody;
const generated_types_1 = require("@vendure/common/lib/generated-types");
const core_1 = require("@vendure/core");
/**
 * Given a SearchInput object, returns the corresponding Elasticsearch body.
 */
function buildElasticBody(input, searchConfig, channelId, languageCode, enabledOnly = false, ctx) {
    const { term, facetValueIds, facetValueOperator, collectionId, collectionSlug, groupByProduct, groupBySKU, skip, take, sort, priceRangeWithTax, priceRange, facetValueFilters, inStock, } = input;
    const query = {
        bool: {},
    };
    ensureBoolFilterExists(query);
    query.bool.filter.push({ term: { channelId } });
    query.bool.filter.push({ term: { languageCode } });
    if (term) {
        query.bool.must = [
            {
                multi_match: {
                    query: term,
                    fuzziness: 'AUTO',
                    type: searchConfig.multiMatchType,
                    fields: [
                        `productName^${searchConfig.boostFields.productName}`,
                        `productVariantName^${searchConfig.boostFields.productVariantName}`,
                        `description^${searchConfig.boostFields.description}`,
                        `sku^${searchConfig.boostFields.sku}`,
                    ],
                },
            },
        ];
    }
    if (facetValueIds && facetValueIds.length) {
        ensureBoolFilterExists(query);
        const operator = facetValueOperator === generated_types_1.LogicalOperator.AND ? 'must' : 'should';
        query.bool.filter = query.bool.filter.concat([
            {
                bool: { [operator]: facetValueIds.map(id => ({ term: { facetValueIds: id } })) },
            },
        ]);
    }
    if (facetValueFilters && facetValueFilters.length) {
        ensureBoolFilterExists(query);
        facetValueFilters.forEach(facetValueFilter => {
            if (facetValueFilter.and && facetValueFilter.or && facetValueFilter.or.length) {
                throw new core_1.UserInputError('error.facetfilterinput-invalid-input');
            }
            if (facetValueFilter.and) {
                query.bool.filter.push({ term: { facetValueIds: facetValueFilter.and } });
            }
            if (facetValueFilter.or && facetValueFilter.or.length) {
                query.bool.filter.push({
                    bool: { ['should']: facetValueFilter.or.map(id => ({ term: { facetValueIds: id } })) },
                });
            }
        });
    }
    if (collectionId) {
        ensureBoolFilterExists(query);
        query.bool.filter.push({ term: { collectionIds: collectionId } });
    }
    if (collectionSlug) {
        ensureBoolFilterExists(query);
        query.bool.filter.push({ term: { collectionSlugs: collectionSlug } });
    }
    if (enabledOnly) {
        ensureBoolFilterExists(query);
        query.bool.filter.push({ term: { enabled: true } });
    }
    if (priceRange) {
        ensureBoolFilterExists(query);
        query.bool.filter = query.bool.filter.concat(createPriceFilters(priceRange, false));
    }
    if (priceRangeWithTax) {
        ensureBoolFilterExists(query);
        query.bool.filter = query.bool.filter.concat(createPriceFilters(priceRangeWithTax, true));
    }
    if (inStock !== undefined) {
        ensureBoolFilterExists(query);
        if (groupByProduct) {
            query.bool.filter.push({ term: { productInStock: inStock } });
        }
        else {
            query.bool.filter.push({ term: { inStock } });
        }
    }
    const sortArray = [];
    if (sort) {
        if (sort.name) {
            sortArray.push({
                'productName.keyword': { order: sort.name === generated_types_1.SortOrder.ASC ? 'asc' : 'desc' },
            });
        }
        if (sort.price) {
            const priceField = 'price';
            sortArray.push({ [priceField]: { order: sort.price === generated_types_1.SortOrder.ASC ? 'asc' : 'desc' } });
        }
    }
    const scriptFields = createScriptFields(searchConfig.scriptFields, input, groupByProduct);
    const body = Object.assign({ query: searchConfig.mapQuery
            ? searchConfig.mapQuery(query, input, searchConfig, channelId, enabledOnly, ctx)
            : query, sort: searchConfig.mapSort ? searchConfig.mapSort(sortArray, input) : sortArray, from: skip || 0, size: take || 10, track_total_hits: searchConfig.totalItemsMaxSize }, (scriptFields !== undefined
        ? {
            _source: true,
            script_fields: scriptFields,
        }
        : undefined));
    if (groupByProduct) {
        body.collapse = { field: 'productId' };
    }
    if (groupBySKU) {
        body.collapse = { field: 'sku.keyword' };
    }
    return body;
}
function ensureBoolFilterExists(query) {
    if (!query.bool.filter) {
        query.bool.filter = [];
    }
}
function createScriptFields(scriptFields, input, groupByProduct) {
    if (scriptFields) {
        const fields = Object.keys(scriptFields);
        if (fields.length) {
            const result = {};
            for (const name of fields) {
                const scriptField = scriptFields[name];
                if (scriptField.context === 'product' && groupByProduct === true) {
                    result[name] = scriptField.scriptFn(input);
                }
                if (scriptField.context === 'variant' && groupByProduct === false) {
                    result[name] = scriptField.scriptFn(input);
                }
                if (scriptField.context === 'both' || scriptField.context === undefined) {
                    result[name] = scriptField.scriptFn(input);
                }
            }
            return result;
        }
    }
    return undefined;
}
function createPriceFilters(range, withTax) {
    const withTaxFix = withTax ? 'WithTax' : '';
    return [
        {
            range: {
                ['price' + withTaxFix]: {
                    gte: range.min,
                    lte: range.max,
                },
            },
        },
    ];
}
//# sourceMappingURL=build-elastic-body.js.map