"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dotenv_1 = require("dotenv");
const path_1 = require("path");
const geoscape_1 = require("./providers/geoscape");
const nzpost_1 = require("./providers/nzpost");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT) || 4000;
// Use project root instead of import.meta.url to avoid ESM/CJS loader issues with ts-node
const PROJECT_ROOT = process.cwd();
const providers = {
    [geoscape_1.geoscapeProvider.id]: geoscape_1.geoscapeProvider,
    [nzpost_1.nzPostDomesticProvider.id]: nzpost_1.nzPostDomesticProvider,
    [nzpost_1.nzPostAustraliaProvider.id]: nzpost_1.nzPostAustraliaProvider,
};
const providerAliases = {
    AU: geoscape_1.geoscapeProvider.id,
    NZ: nzpost_1.nzPostDomesticProvider.id,
    'NZPOST-AU': nzpost_1.nzPostAustraliaProvider.id,
    AU_NZPOST: nzpost_1.nzPostAustraliaProvider.id,
};
const DEFAULT_PROVIDER_ID = geoscape_1.geoscapeProvider.id;
function resolveProviderId(req) {
    const providerRaw = Array.isArray(req.query.provider)
        ? req.query.provider[0]
        : req.query.provider;
    const providerParam = providerRaw == null ? undefined : String(providerRaw);
    if (providerParam && providers[providerParam])
        return providerParam;
    const countryRaw = Array.isArray(req.query.country)
        ? req.query.country[0]
        : req.query.country;
    const countryParam = countryRaw == null ? undefined : String(countryRaw);
    if (countryParam) {
        const alias = providerAliases[String(countryParam).toUpperCase()];
        if (alias && providers[alias])
            return alias;
    }
    return DEFAULT_PROVIDER_ID;
}
function handleProviderError(res, error) {
    const message = typeof error === 'string'
        ? error
        : error instanceof Error
            ? error.message
            : 'Unknown provider error';
    res.status(500).json({ message });
}
// Serve static client in production (if you build and put in /build)
app.use(express_1.default.static(path_1.default.join(PROJECT_ROOT, 'build')));
app.get('/api/providers', (_req, res) => {
    const list = Object.values(providers).map((provider) => ({
        id: provider.id,
        label: provider.label,
    }));
    res.json({ providers: list, default: DEFAULT_PROVIDER_ID });
});
app.get('/api/predict', async (req, res) => {
    var _a, _b;
    const queryValue = (_b = (_a = req.query.query) !== null && _a !== void 0 ? _a : req.query.q) !== null && _b !== void 0 ? _b : req.query.text;
    if (!queryValue)
        return res.status(400).json({ message: 'query parameter required' });
    const searchValue = String(queryValue).trim();
    if (!searchValue)
        return res.status(400).json({ message: 'query parameter required' });
    const providerId = resolveProviderId(req);
    const provider = providers[providerId];
    if (!provider)
        return res.status(400).json({ message: `Unknown provider: ${providerId}` });
    try {
        const result = await provider.predict(searchValue);
        res.json(result);
    }
    catch (error) {
        handleProviderError(res, error);
    }
});
app.get('/api/address/:id', async (req, res) => {
    const id = req.params.id;
    if (!id)
        return res.status(400).json({ message: 'Address id required' });
    const providerId = resolveProviderId(req);
    const provider = providers[providerId];
    if (!provider)
        return res.status(400).json({ message: `Unknown provider: ${providerId}` });
    try {
        const result = await provider.detail(id);
        res.json(result);
    }
    catch (error) {
        handleProviderError(res, error);
    }
});
// Fallback to client index
app.get('*', (_req, res) => {
    res.sendFile(path_1.default.join(PROJECT_ROOT, 'build', 'index.html'));
});
app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
exports.default = app;
