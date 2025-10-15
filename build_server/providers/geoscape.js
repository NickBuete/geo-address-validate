"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.geoscapeProvider = void 0;
const GEOSCAPE_PREDICT_URL = (process.env.GEOSCAPE_PREDICT_URL ||
    'https://api.psma.com.au/v1/predictive/address').replace(/\/$/, '');
const GEOSCAPE_ADDRESS_URL = (process.env.GEOSCAPE_ADDRESS_URL || GEOSCAPE_PREDICT_URL).replace(/\/$/, '');
const GEOSCAPE_PREDICT_QUERY_PARAM = process.env.GEOSCAPE_PREDICT_QUERY_PARAM || process.env.GEOSCAPE_QUERY_PARAM || 'query';
function getGeoscapeAuthToken() {
    return process.env.GEOSCAPE_CONSUMER_KEY || process.env.GEOSCAPE_API_KEY;
}
function normaliseSuggestions(data) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    const candidateArrays = [];
    const direct = [
        data === null || data === void 0 ? void 0 : data.suggestions,
        data === null || data === void 0 ? void 0 : data.results,
        data === null || data === void 0 ? void 0 : data.predictions,
        data === null || data === void 0 ? void 0 : data.addresses,
        data === null || data === void 0 ? void 0 : data.items,
        data === null || data === void 0 ? void 0 : data.addressList,
        data === null || data === void 0 ? void 0 : data.suggestedAddresses,
        data === null || data === void 0 ? void 0 : data.suggest,
    ];
    candidateArrays.push(...direct);
    candidateArrays.push((_a = data === null || data === void 0 ? void 0 : data.response) === null || _a === void 0 ? void 0 : _a.suggestions);
    candidateArrays.push((_b = data === null || data === void 0 ? void 0 : data.response) === null || _b === void 0 ? void 0 : _b.results);
    candidateArrays.push((_c = data === null || data === void 0 ? void 0 : data.content) === null || _c === void 0 ? void 0 : _c.suggestions);
    candidateArrays.push((_d = data === null || data === void 0 ? void 0 : data.content) === null || _d === void 0 ? void 0 : _d.results);
    candidateArrays.push((_e = data === null || data === void 0 ? void 0 : data.data) === null || _e === void 0 ? void 0 : _e.suggestions);
    candidateArrays.push((_f = data === null || data === void 0 ? void 0 : data.data) === null || _f === void 0 ? void 0 : _f.results);
    candidateArrays.push((_g = data === null || data === void 0 ? void 0 : data.data) === null || _g === void 0 ? void 0 : _g.items);
    candidateArrays.push((_h = data === null || data === void 0 ? void 0 : data.result) === null || _h === void 0 ? void 0 : _h.suggestions);
    candidateArrays.push((_j = data === null || data === void 0 ? void 0 : data.result) === null || _j === void 0 ? void 0 : _j.results);
    candidateArrays.push((_k = data === null || data === void 0 ? void 0 : data.result) === null || _k === void 0 ? void 0 : _k.items);
    candidateArrays.push((_l = data === null || data === void 0 ? void 0 : data.result) === null || _l === void 0 ? void 0 : _l.addresses);
    candidateArrays.push((_m = data === null || data === void 0 ? void 0 : data.addresses) === null || _m === void 0 ? void 0 : _m.results);
    const flattened = candidateArrays
        .filter((value) => Array.isArray(value))
        .flat()
        .filter(Boolean);
    if (flattened.length > 0) {
        return flattened;
    }
    if (data && typeof data === 'object') {
        const maybeSingle = data.suggestion || data.result || data.prediction || data.address || data.item;
        if (maybeSingle) {
            return [maybeSingle];
        }
    }
    return [];
}
function suggestionText(suggestion) {
    var _a, _b;
    return ((suggestion === null || suggestion === void 0 ? void 0 : suggestion.text) ||
        (suggestion === null || suggestion === void 0 ? void 0 : suggestion.address) ||
        (suggestion === null || suggestion === void 0 ? void 0 : suggestion.formattedAddress) ||
        (suggestion === null || suggestion === void 0 ? void 0 : suggestion.fullAddress) ||
        (suggestion === null || suggestion === void 0 ? void 0 : suggestion.addressLine) ||
        (suggestion === null || suggestion === void 0 ? void 0 : suggestion.displayAddress) ||
        (suggestion === null || suggestion === void 0 ? void 0 : suggestion.label) ||
        (suggestion === null || suggestion === void 0 ? void 0 : suggestion.name) ||
        ((_a = suggestion === null || suggestion === void 0 ? void 0 : suggestion.address) === null || _a === void 0 ? void 0 : _a.formattedAddress) ||
        ((_b = suggestion === null || suggestion === void 0 ? void 0 : suggestion.address) === null || _b === void 0 ? void 0 : _b.fullAddress) ||
        (suggestion === null || suggestion === void 0 ? void 0 : suggestion.summary) ||
        JSON.stringify(suggestion));
}
async function geoscapePredict(query) {
    const authToken = getGeoscapeAuthToken();
    if (!authToken) {
        throw new Error('GEOSCAPE_CONSUMER_KEY (or GEOSCAPE_API_KEY fallback) not configured');
    }
    const url = new URL(GEOSCAPE_PREDICT_URL);
    url.searchParams.set(GEOSCAPE_PREDICT_QUERY_PARAM, query);
    if (GEOSCAPE_PREDICT_QUERY_PARAM !== 'query') {
        url.searchParams.set('query', query);
    }
    if (GEOSCAPE_PREDICT_QUERY_PARAM !== 'q') {
        url.searchParams.set('q', query);
    }
    const response = await fetch(url.toString(), {
        headers: {
            Authorization: authToken,
            Accept: 'application/json',
        },
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Geoscape request failed (${response.status}): ${text}`);
    }
    const data = await response.json();
    const suggestionsRaw = normaliseSuggestions(data);
    const suggestions = suggestionsRaw.map((suggestion, index) => {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        return ({
            id: String((_h = (_f = (_d = (_c = (_b = (_a = suggestion === null || suggestion === void 0 ? void 0 : suggestion.id) !== null && _a !== void 0 ? _a : suggestion === null || suggestion === void 0 ? void 0 : suggestion.addressId) !== null && _b !== void 0 ? _b : suggestion === null || suggestion === void 0 ? void 0 : suggestion.addressIdentifier) !== null && _c !== void 0 ? _c : suggestion === null || suggestion === void 0 ? void 0 : suggestion.identifier) !== null && _d !== void 0 ? _d : (_e = suggestion === null || suggestion === void 0 ? void 0 : suggestion.address) === null || _e === void 0 ? void 0 : _e.id) !== null && _f !== void 0 ? _f : (_g = suggestion === null || suggestion === void 0 ? void 0 : suggestion.address) === null || _g === void 0 ? void 0 : _g.addressId) !== null && _h !== void 0 ? _h : index),
            text: suggestionText(suggestion),
        });
    });
    return { suggestions, raw: data };
}
async function geoscapeDetail(id) {
    const authToken = getGeoscapeAuthToken();
    if (!authToken) {
        throw new Error('GEOSCAPE_CONSUMER_KEY (or GEOSCAPE_API_KEY fallback) not configured');
    }
    const url = new URL(`${GEOSCAPE_ADDRESS_URL}/${encodeURIComponent(id)}`);
    const response = await fetch(url.toString(), {
        headers: {
            Authorization: authToken,
            Accept: 'application/json',
        },
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Geoscape details failed (${response.status}): ${text}`);
    }
    const data = await response.json();
    return { address: data, raw: data };
}
exports.geoscapeProvider = {
    id: 'geoscape-au',
    label: 'Australia – Geoscape Predictive (PSMA)',
    predict: geoscapePredict,
    detail: geoscapeDetail,
};
