"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const axios_1 = __importDefault(require("axios"));
const FALLBACK_PROVIDERS = [
    { id: 'geoscape-au', label: 'Australia – Geoscape Predictive' },
    { id: 'nzpost-nz', label: 'New Zealand – NZ Post Domestic' },
    { id: 'nzpost-au', label: 'Australia – NZ Post International' },
];
function App() {
    var _a, _b;
    const [query, setQuery] = (0, react_1.useState)('');
    const [provider, setProvider] = (0, react_1.useState)('geoscape-au');
    const [providerOptions, setProviderOptions] = (0, react_1.useState)(FALLBACK_PROVIDERS);
    const [providersLoaded, setProvidersLoaded] = (0, react_1.useState)(false);
    const [results, setResults] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const [confirmingId, setConfirmingId] = (0, react_1.useState)(null);
    const [selectedId, setSelectedId] = (0, react_1.useState)(null);
    const [confirmedAddress, setConfirmedAddress] = (0, react_1.useState)(null);
    const [confirmError, setConfirmError] = (0, react_1.useState)(null);
    const [lastQuery, setLastQuery] = (0, react_1.useState)('');
    const [lastProvider, setLastProvider] = (0, react_1.useState)('geoscape-au');
    const [rawResponse, setRawResponse] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        let cancelled = false;
        function loadProviders() {
            var _a, _b;
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const res = yield axios_1.default.get('/api/providers');
                    if (cancelled)
                        return;
                    const list = ((_a = res.data) === null || _a === void 0 ? void 0 : _a.providers) || FALLBACK_PROVIDERS;
                    setProviderOptions(list);
                    const defaultId = (_b = res.data) === null || _b === void 0 ? void 0 : _b.default;
                    if (defaultId && list.some((opt) => opt.id === defaultId)) {
                        setProvider(defaultId);
                    }
                }
                catch (_c) {
                    // fallback already set
                }
                finally {
                    if (!cancelled)
                        setProvidersLoaded(true);
                }
            });
        }
        loadProviders();
        return () => {
            cancelled = true;
        };
    }, []);
    (0, react_1.useEffect)(() => {
        const trimmed = query.trim();
        if (!trimmed) {
            setResults([]);
            setError(null);
            setLoading(false);
            setSelectedId(null);
            setConfirmingId(null);
            setConfirmedAddress(null);
            setConfirmError(null);
            setLastQuery('');
            setLastProvider(provider);
            setRawResponse(null);
            return;
        }
        setSelectedId(null);
        setConfirmedAddress(null);
        setConfirmError(null);
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            setLoading(true);
            try {
                const res = yield axios_1.default.get('/api/predict', {
                    params: { query: trimmed, provider },
                    signal: controller.signal,
                });
                setLastQuery(trimmed);
                setLastProvider(provider);
                const suggestions = res.data.suggestions || [];
                setResults(suggestions);
                setRawResponse((_b = (_a = res.data) === null || _a === void 0 ? void 0 : _a.raw) !== null && _b !== void 0 ? _b : res.data);
                setError(null);
            }
            catch (err) {
                if (axios_1.default.isCancel(err) || (err === null || err === void 0 ? void 0 : err.code) === 'ERR_CANCELED') {
                    return;
                }
                setError(((_d = (_c = err === null || err === void 0 ? void 0 : err.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.message) || err.message);
                setRawResponse((_f = (_e = err === null || err === void 0 ? void 0 : err.response) === null || _e === void 0 ? void 0 : _e.data) !== null && _f !== void 0 ? _f : null);
            }
            finally {
                setLoading(false);
            }
        }), 400);
        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [query, provider]);
    function handleManualSubmit(e) {
        e.preventDefault();
    }
    function handleProviderChange(next) {
        if (next === provider)
            return;
        setProvider(next);
        setResults([]);
        setSelectedId(null);
        setConfirmedAddress(null);
        setConfirmError(null);
        setError(null);
        setRawResponse(null);
        setLastQuery('');
        setLastProvider(next);
    }
    function handleSelect(suggestion) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            if (!suggestion.id)
                return;
            setConfirmingId(suggestion.id);
            setSelectedId(suggestion.id);
            setConfirmError(null);
            setConfirmedAddress(null);
            try {
                const res = yield axios_1.default.get(`/api/address/${encodeURIComponent(suggestion.id)}`, {
                    params: { provider },
                });
                setConfirmedAddress(res.data.address || null);
            }
            catch (err) {
                setConfirmError(((_b = (_a = err === null || err === void 0 ? void 0 : err.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || err.message);
            }
            finally {
                setConfirmingId(null);
            }
        });
    }
    const providerLabel = ((_a = providerOptions.find((option) => option.id === provider)) === null || _a === void 0 ? void 0 : _a.label) || provider;
    return ((0, jsx_runtime_1.jsxs)("div", Object.assign({ className: "container py-4" }, { children: [(0, jsx_runtime_1.jsx)("h1", Object.assign({ className: "mb-4" }, { children: "Predictive Address Test" })), (0, jsx_runtime_1.jsxs)("div", Object.assign({ className: "mb-3" }, { children: [(0, jsx_runtime_1.jsx)("label", Object.assign({ className: "form-label fw-semibold", htmlFor: "provider-select" }, { children: "Data Source" })), (0, jsx_runtime_1.jsx)("select", Object.assign({ id: "provider-select", className: "form-select", value: provider, onChange: (event) => handleProviderChange(event.target.value), disabled: !providersLoaded }, { children: providerOptions.map((option) => ((0, jsx_runtime_1.jsx)("option", Object.assign({ value: option.id }, { children: option.label }), option.id))) }))] })), (0, jsx_runtime_1.jsx)("form", Object.assign({ onSubmit: handleManualSubmit, className: "mb-3" }, { children: (0, jsx_runtime_1.jsxs)("div", Object.assign({ className: "input-group" }, { children: [(0, jsx_runtime_1.jsx)("input", { className: "form-control", placeholder: "Start typing an address or suburb", value: query, onChange: (e) => setQuery(e.target.value) }), (0, jsx_runtime_1.jsx)("button", Object.assign({ className: "btn btn-primary", type: "submit", disabled: loading || !query }, { children: loading ? 'Searching…' : 'Search' }))] })) })), error && (0, jsx_runtime_1.jsx)("div", Object.assign({ className: "alert alert-danger" }, { children: error })), (0, jsx_runtime_1.jsxs)("div", Object.assign({ className: "row g-4" }, { children: [(0, jsx_runtime_1.jsxs)("div", Object.assign({ className: "col-md-6" }, { children: [results.length === 0 && !loading && ((0, jsx_runtime_1.jsx)("p", Object.assign({ className: "text-muted" }, { children: "No suggestions yet. Try searching above." }))), (0, jsx_runtime_1.jsx)("div", Object.assign({ className: "list-group" }, { children: results.map((suggestion) => ((0, jsx_runtime_1.jsx)("button", Object.assign({ type: "button", className: `list-group-item list-group-item-action${selectedId === suggestion.id ? ' active' : ''}`, onClick: () => handleSelect(suggestion), disabled: Boolean(confirmingId) }, { children: (0, jsx_runtime_1.jsxs)("div", Object.assign({ className: "d-flex flex-column align-items-start" }, { children: [(0, jsx_runtime_1.jsx)("span", { children: suggestion.text }), suggestion.source && ((0, jsx_runtime_1.jsx)("span", Object.assign({ className: "text-muted small" }, { children: suggestion.source })))] })) }), suggestion.id))) }))] })), (0, jsx_runtime_1.jsxs)("div", Object.assign({ className: "col-md-6" }, { children: [confirmingId && ((0, jsx_runtime_1.jsx)("div", Object.assign({ className: "alert alert-info" }, { children: "Confirming address\u2026" }))), confirmError && ((0, jsx_runtime_1.jsx)("div", Object.assign({ className: "alert alert-danger" }, { children: confirmError }))), confirmedAddress && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", Object.assign({ className: "h5" }, { children: "Confirmed Address" })), (0, jsx_runtime_1.jsx)("pre", Object.assign({ className: "bg-light p-3 border rounded" }, { children: JSON.stringify(confirmedAddress, null, 2) }))] }))] })), (0, jsx_runtime_1.jsx)("div", Object.assign({ className: "col-12" }, { children: (0, jsx_runtime_1.jsx)("div", Object.assign({ className: "card" }, { children: (0, jsx_runtime_1.jsxs)("div", Object.assign({ className: "card-body" }, { children: [(0, jsx_runtime_1.jsx)("h2", Object.assign({ className: "h6" }, { children: "Debug Info" })), (0, jsx_runtime_1.jsxs)("p", Object.assign({ className: "mb-1" }, { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Current input:" }), " ", query || (0, jsx_runtime_1.jsx)("span", Object.assign({ className: "text-muted" }, { children: "n/a" }))] })), (0, jsx_runtime_1.jsxs)("p", Object.assign({ className: "mb-3" }, { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Last request:" }), ' ', lastQuery ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [lastQuery, ' ', (0, jsx_runtime_1.jsxs)("span", Object.assign({ className: "text-muted" }, { children: ["(provider: ", ((_b = providerOptions.find((opt) => opt.id === lastProvider)) === null || _b === void 0 ? void 0 : _b.label) ||
                                                                lastProvider, ")"] }))] })) : ((0, jsx_runtime_1.jsx)("span", Object.assign({ className: "text-muted" }, { children: "n/a" })))] })), (0, jsx_runtime_1.jsxs)("p", Object.assign({ className: "mb-3" }, { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Active provider:" }), " ", providerLabel] })), (0, jsx_runtime_1.jsxs)("div", Object.assign({ className: "mb-3" }, { children: [(0, jsx_runtime_1.jsxs)("strong", { children: ["Suggestions (", results.length, "):"] }), (0, jsx_runtime_1.jsx)("pre", Object.assign({ className: "bg-light p-3 border rounded small mt-2" }, { children: results.length > 0
                                                    ? JSON.stringify(results, null, 2)
                                                    : '[]' }))] })), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Raw response:" }), (0, jsx_runtime_1.jsx)("pre", Object.assign({ className: "bg-light p-3 border rounded small mt-2" }, { children: rawResponse ? JSON.stringify(rawResponse, null, 2) : 'null' }))] })] })) })) }))] }))] })));
}
exports.default = App;
