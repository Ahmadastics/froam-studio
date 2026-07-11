import { getFroamStudioConfig } from '../config.js';
export class FroamStudioApiError extends Error {
    status;
    details;
    constructor(message, status, details) {
        super(message);
        this.name = 'FroamStudioApiError';
        this.status = status;
        this.details = details;
    }
}
function trimTrailingSlash(value) {
    return value.replace(/\/+$/, '');
}
function resolveEndpoint(endpoint) {
    if (/^https?:\/\//i.test(endpoint))
        return endpoint;
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const baseUrl = getFroamStudioConfig().apiBaseUrl?.trim();
    return baseUrl ? `${trimTrailingSlash(baseUrl)}${normalizedEndpoint}` : normalizedEndpoint;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function safelyParseJson(value) {
    try {
        return JSON.parse(value);
    }
    catch {
        return { raw: value };
    }
}
export async function api(endpoint, options = {}) {
    const { method = 'GET', body, cache = false } = options;
    const fetcher = getFroamStudioConfig().fetch ?? globalThis.fetch;
    if (!fetcher) {
        throw new FroamStudioApiError('Froam Studio could not find a fetch implementation.', 0);
    }
    const normalizedMethod = method.toUpperCase();
    const headers = {};
    const request = {
        method: normalizedMethod,
        credentials: 'include',
        cache: cache ? 'default' : 'no-store',
        headers,
    };
    if (body !== undefined && normalizedMethod !== 'GET') {
        headers['Content-Type'] = 'application/json';
        request.body = JSON.stringify(body);
    }
    const response = await fetcher(resolveEndpoint(endpoint), request);
    const rawText = await response.text();
    const data = rawText ? safelyParseJson(rawText) : null;
    if (!response.ok) {
        const errorData = isRecord(data) ? data : null;
        let message = typeof errorData?.error === 'string'
            ? errorData.error
            : `Froam Studio API Error ${response.status}`;
        if (errorData?.details)
            message += `: ${JSON.stringify(errorData.details)}`;
        throw new FroamStudioApiError(message, response.status, errorData?.details);
    }
    return data;
}
export const apiGetFresh = (endpoint) => api(endpoint, { cache: false });
export const apiPost = (endpoint, body) => api(endpoint, { method: 'POST', body });
export const apiDelete = (endpoint) => api(endpoint, { method: 'DELETE' });
//# sourceMappingURL=api.js.map