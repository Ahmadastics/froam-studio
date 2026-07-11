let config = {};
export function configureFroamStudio(next = {}) {
    config = { ...config, ...next };
    return config;
}
export function getFroamStudioConfig() {
    return config;
}
export function resetFroamStudioConfig() {
    config = {};
}
export function normalizeOwnerEmails(value) {
    const values = Array.isArray(value) ? value : String(value ?? '').split(',');
    return values
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
}
export function getFroamRootElement() {
    if (typeof document === 'undefined')
        return null;
    const selector = config.rootSelector;
    if (typeof selector === 'function')
        return selector();
    if (selector)
        return document.querySelector(selector);
    return (document.querySelector('[data-froam-root]')
        ?? document.getElementById('root')
        ?? document.getElementById('__next')
        ?? document.querySelector('main')
        ?? document.body);
}
//# sourceMappingURL=config.js.map