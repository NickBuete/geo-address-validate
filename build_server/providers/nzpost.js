"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.nzPostAustraliaProvider = exports.nzPostDomesticProvider = void 0;
const NZPOST_BASE_URL = (process.env.NZPOST_BASE_URL ||
    'https://api.nzpost.co.nz/addresschecker/1.0').replace(/\/$/, '');
const NZPOST_PARCEL_BASE_URL = (process.env.NZPOST_PARCEL_BASE_URL ||
    'https://api.nzpost.co.nz/parceladdress/2.0').replace(/\/$/, '');
const NZPOST_DEFAULT_TYPE = process.env.NZPOST_DEFAULT_TYPE || 'All';
const NZPOST_MAX_RESULTS = Number(process.env.NZPOST_MAX_RESULTS || '10');
const NZPOST_ACCEPT = process.env.NZPOST_ACCEPT || 'application/json';
const NZPOST_TOKEN_URL = (process.env.NZPOST_TOKEN_URL ||
    'https://oauth.nzpost.co.nz/as/token.oauth2').trim();
const NZPOST_SCOPE = (_a = process.env.NZPOST_SCOPE) !== null && _a !== void 0 ? _a : '';
const NZPOST_AU_COUNTRY = process.env.NZPOST_AU_COUNTRY || 'australia';
let nzPostTokenCache = null;
let nzPostTokenPromise = null;
function getNzPostCredentials() {
    return {
        manualToken: process.env.NZPOST_BEARER_TOKEN,
        clientId: process.env.NZPOST_CLIENT_ID,
        clientSecret: process.env.NZPOST_CLIENT_SECRET,
        userName: process.env.NZPOST_USER_NAME,
    };
}
function invalidateNzPostToken() {
    nzPostTokenCache = null;
}
async function getNzPostAccessToken(forceRefresh = false) {
    if (!forceRefresh && nzPostTokenCache && nzPostTokenCache.expiresAt > Date.now()) {
        return nzPostTokenCache.token;
    }
    if (nzPostTokenPromise && !forceRefresh) {
        return nzPostTokenPromise;
    }
    const { clientId, clientSecret } = getNzPostCredentials();
    if (!clientId || !clientSecret) {
        throw new Error('NZPOST_CLIENT_ID and NZPOST_CLIENT_SECRET must be configured for automatic token retrieval');
    }
    const params = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId });
    if (NZPOST_SCOPE) {
        params.set('scope', NZPOST_SCOPE);
    }
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const requestToken = async () => {
        const response = await fetch(NZPOST_TOKEN_URL, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`NZ Post token request failed (${response.status}): ${text}`);
        }
        const data = await response.json();
        const token = data === null || data === void 0 ? void 0 : data.access_token;
        if (!token) {
            throw new Error('NZ Post token response missing access_token');
        }
        const expiresIn = Number(data === null || data === void 0 ? void 0 : data.expires_in) || 1800;
        const expiresAt = Date.now() + Math.max(expiresIn - 60, 60) * 1000;
        nzPostTokenCache = { token, expiresAt };
        return token;
    };
    nzPostTokenPromise = requestToken();
    try {
        const token = await nzPostTokenPromise;
        return token;
    }
    finally {
        nzPostTokenPromise = null;
    }
}
async function buildNzPostHeaders(forceRefresh = false) {
    const { manualToken, clientId, userName } = getNzPostCredentials();
    if (!clientId) {
        return null;
    }
    const headers = {
        client_id: clientId,
        Accept: NZPOST_ACCEPT,
    };
    if (userName) {
        headers['user_name'] = userName;
    }
    if (manualToken) {
        headers.Authorization = manualToken.startsWith('Bearer ')
            ? manualToken
            : `Bearer ${manualToken}`;
        return { headers, refreshable: false };
    }
    const token = await getNzPostAccessToken(forceRefresh);
    headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    return { headers, refreshable: true };
}
async function requestNzPostJson(url, forceRefresh = false) {
    let headerResult = await buildNzPostHeaders(forceRefresh);
    if (!headerResult) {
        throw new Error('NZPOST_CLIENT_ID and either NZPOST_BEARER_TOKEN or NZPOST_CLIENT_SECRET must be configured');
    }
    let response = await fetch(url.toString(), {
        headers: headerResult.headers,
    });
    if (response.status === 401 && headerResult.refreshable) {
        invalidateNzPostToken();
        headerResult = await buildNzPostHeaders(true);
        if (!headerResult) {
            throw new Error('NZ Post credentials missing after refresh attempt');
        }
        response = await fetch(url.toString(), {
            headers: headerResult.headers,
        });
    }
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`NZ Post request failed (${response.status}): ${text}`);
    }
    return response.json();
}
function mapNzPostSuggestion(address, index) {
    var _a, _b, _c, _d, _e, _f;
    const id = (_f = (_e = (_d = (_c = (_b = (_a = address === null || address === void 0 ? void 0 : address.DPID) !== null && _a !== void 0 ? _a : address === null || address === void 0 ? void 0 : address.dpid) !== null && _b !== void 0 ? _b : address === null || address === void 0 ? void 0 : address.UniqueId) !== null && _c !== void 0 ? _c : address === null || address === void 0 ? void 0 : address.unique_id) !== null && _d !== void 0 ? _d : address === null || address === void 0 ? void 0 : address.address_id) !== null && _e !== void 0 ? _e : address === null || address === void 0 ? void 0 : address.addressId) !== null && _f !== void 0 ? _f : index;
    const text = (address === null || address === void 0 ? void 0 : address.FullAddress) ||
        (address === null || address === void 0 ? void 0 : address.full_address) ||
        (address === null || address === void 0 ? void 0 : address.FullPartial) ||
        (address === null || address === void 0 ? void 0 : address.formatted_address) ||
        (address === null || address === void 0 ? void 0 : address.display_address) ||
        (address === null || address === void 0 ? void 0 : address.address) ||
        (address === null || address === void 0 ? void 0 : address.description) ||
        JSON.stringify(address);
    const source = (address === null || address === void 0 ? void 0 : address.SourceDesc) || (address === null || address === void 0 ? void 0 : address.source_desc) || (address === null || address === void 0 ? void 0 : address.source) || (address === null || address === void 0 ? void 0 : address.type);
    return {
        id: String(id),
        text,
        source,
    };
}
function extractSuggestions(data) {
    var _a, _b;
    const candidateArrays = [
        data === null || data === void 0 ? void 0 : data.addresses,
        data === null || data === void 0 ? void 0 : data.results,
        data === null || data === void 0 ? void 0 : data.suggestions,
        data === null || data === void 0 ? void 0 : data.items,
        (_a = data === null || data === void 0 ? void 0 : data.data) === null || _a === void 0 ? void 0 : _a.addresses,
        (_b = data === null || data === void 0 ? void 0 : data.data) === null || _b === void 0 ? void 0 : _b.results,
    ].filter((arr) => Array.isArray(arr));
    if (candidateArrays.length === 0)
        return [];
    return candidateArrays[0];
}
async function nzPostDomesticPredict(query) {
    const url = new URL(`${NZPOST_BASE_URL}/suggest`);
    url.searchParams.set('q', query);
    url.searchParams.set('max', String(NZPOST_MAX_RESULTS));
    if (NZPOST_DEFAULT_TYPE) {
        url.searchParams.set('type', NZPOST_DEFAULT_TYPE);
    }
    const data = await requestNzPostJson(url);
    const addresses = extractSuggestions(data);
    const suggestions = addresses.map(mapNzPostSuggestion);
    return { suggestions, raw: data };
}
async function nzPostDomesticDetail(id) {
    var _a, _b;
    const url = new URL(`${NZPOST_BASE_URL}/details`);
    url.searchParams.set('dpid', id);
    url.searchParams.set('max', '1');
    if (NZPOST_DEFAULT_TYPE) {
        url.searchParams.set('type', NZPOST_DEFAULT_TYPE);
    }
    const data = await requestNzPostJson(url);
    const details = Array.isArray(data === null || data === void 0 ? void 0 : data.details) ? data.details : [];
    const address = (_b = (_a = details[0]) !== null && _a !== void 0 ? _a : data === null || data === void 0 ? void 0 : data.address) !== null && _b !== void 0 ? _b : data;
    if (!address) {
        throw new Error('NZ Post detail response missing address data');
    }
    return { address, raw: data };
}
async function nzPostAustraliaPredict(query) {
    const url = new URL(`${NZPOST_PARCEL_BASE_URL}/international/addresses`);
    url.searchParams.set('q', query);
    url.searchParams.set('country', NZPOST_AU_COUNTRY);
    url.searchParams.set('count', String(NZPOST_MAX_RESULTS));
    const data = await requestNzPostJson(url);
    const addresses = extractSuggestions(data);
    const suggestions = addresses.map(mapNzPostSuggestion);
    return { suggestions, raw: data };
}
async function nzPostAustraliaDetail(id) {
    var _a, _b, _c, _d, _e;
    const url = new URL(`${NZPOST_PARCEL_BASE_URL}/australia/addresses/${encodeURIComponent(id)}`);
    const data = await requestNzPostJson(url);
    const address = (_e = (_c = (_a = data === null || data === void 0 ? void 0 : data.address) !== null && _a !== void 0 ? _a : (_b = data === null || data === void 0 ? void 0 : data.addresses) === null || _b === void 0 ? void 0 : _b[0]) !== null && _c !== void 0 ? _c : (_d = data === null || data === void 0 ? void 0 : data.details) === null || _d === void 0 ? void 0 : _d[0]) !== null && _e !== void 0 ? _e : data;
    if (!address) {
        throw new Error('NZ Post Australia detail response missing address');
    }
    return { address, raw: data };
}
exports.nzPostDomesticProvider = {
    id: 'nzpost-nz',
    label: 'New Zealand – NZ Post Domestic',
    predict: nzPostDomesticPredict,
    detail: nzPostDomesticDetail,
};
exports.nzPostAustraliaProvider = {
    id: 'nzpost-au',
    label: 'Australia – NZ Post International',
    predict: nzPostAustraliaPredict,
    detail: nzPostAustraliaDetail,
};
