export const FROAM_UI_PREFERENCE_KEY = 'froam-ui-preference-v1';
export const DEFAULT_FROAM_UI_PREFERENCE = {
    version: 1,
    toolbar: 'top',
    workspace: 'attached',
    panels: 'standard',
    density: 'comfortable',
    appearance: 'graphite',
    accent: 'mint',
    leftSize: 'standard',
    inspectorSize: 'standard',
    scale: 1,
    labels: true,
};
const values = {
    toolbar: ['top', 'bottom'], workspace: ['attached', 'floating-bottom'], panels: ['standard', 'mirrored'],
    density: ['compact', 'comfortable'], appearance: ['graphite', 'midnight', 'glass'], accent: ['mint', 'blue', 'violet', 'coral'],
    leftSize: ['narrow', 'standard', 'wide'], inspectorSize: ['narrow', 'standard', 'wide'], scale: [0.9, 1, 1.1],
};
function allowed(list, value, fallback) { return list.includes(value) ? value : fallback; }
export function sanitizeFroamUIPreference(value) {
    const input = value && typeof value === 'object' ? value : {};
    return {
        version: 1,
        toolbar: allowed(values.toolbar, input.toolbar, DEFAULT_FROAM_UI_PREFERENCE.toolbar),
        workspace: allowed(values.workspace, input.workspace, DEFAULT_FROAM_UI_PREFERENCE.workspace),
        panels: allowed(values.panels, input.panels, DEFAULT_FROAM_UI_PREFERENCE.panels),
        density: allowed(values.density, input.density, DEFAULT_FROAM_UI_PREFERENCE.density),
        appearance: allowed(values.appearance, input.appearance, DEFAULT_FROAM_UI_PREFERENCE.appearance),
        accent: allowed(values.accent, input.accent, DEFAULT_FROAM_UI_PREFERENCE.accent),
        leftSize: allowed(values.leftSize, input.leftSize, DEFAULT_FROAM_UI_PREFERENCE.leftSize),
        inspectorSize: allowed(values.inspectorSize, input.inspectorSize, DEFAULT_FROAM_UI_PREFERENCE.inspectorSize),
        scale: allowed(values.scale, input.scale, DEFAULT_FROAM_UI_PREFERENCE.scale),
        labels: typeof input.labels === 'boolean' ? input.labels : DEFAULT_FROAM_UI_PREFERENCE.labels,
    };
}
export function readFroamUIPreference(storage) {
    try {
        return sanitizeFroamUIPreference(JSON.parse(storage?.getItem(FROAM_UI_PREFERENCE_KEY) ?? 'null'));
    }
    catch {
        return { ...DEFAULT_FROAM_UI_PREFERENCE };
    }
}
export function writeFroamUIPreference(storage, preference) {
    try {
        storage?.setItem(FROAM_UI_PREFERENCE_KEY, JSON.stringify(sanitizeFroamUIPreference(preference)));
        return true;
    }
    catch {
        return false;
    }
}
export function froamUIPanelWidth(size, kind) {
    const widths = kind === 'left' ? { narrow: 210, standard: 240, wide: 300 } : { narrow: 280, standard: 300, wide: 380 };
    return widths[size];
}
//# sourceMappingURL=froamUIPreferences.js.map