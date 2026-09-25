import { clearOpLog } from '../../collab/persist.js';
import { isSafeDraftPath } from '../../collab/paths.js';
import { froamStorageKey } from '../../project/storage-scope.js';
import { sanitizeBrandFonts } from '../fontSources.js';
import { DEFAULT_FROAM_PERSONA, FROAM_PERSONA_PATH, PERSONA_STORAGE_KEY, sanitizeFroamPersona, isFroamPersonaPath, } from '../froamPersona.js';
import { CANVAS_KEY } from './types.js';
export const STORAGE_KEY = 'froam-editor-store-v1';
export const NODE_REGISTRY_KEY = 'froam-node-registry-v1';
/** Retired in 4.9.4 — history is the op log now. Kept only to clear it. */
export const LEGACY_HISTORY_KEY = 'froam-history-v1';
export const MAX_INLINE_ASSET_LENGTH = 40_000;
export const MAX_PERSONA_IMAGE_BYTES = 400_000;
export const SAVE_META_KEY = 'froam-last-save-v1';
/* Migrate drafts saved under pre-3.1 (Run'Am-branded) localStorage keys. */
if (typeof window !== 'undefined') {
    try {
        const legacyPairs = [
            ['runam-chef-editor-store-v1', STORAGE_KEY],
            ['runam-froam-last-save-v1', SAVE_META_KEY],
        ];
        // Snapshot history is gone; don't leave 600 KB of it behind.
        for (const dead of ['runam-froam-history-v1', LEGACY_HISTORY_KEY]) {
            try {
                window.localStorage.removeItem(dead);
            }
            catch { /* ignore */ }
        }
        for (const [oldKey, newKey] of legacyPairs) {
            const legacy = window.localStorage.getItem(oldKey);
            if (legacy !== null && window.localStorage.getItem(newKey) === null) {
                window.localStorage.setItem(newKey, legacy);
            }
        }
    }
    catch { /* storage unavailable */ }
}
/* The picker's list is derived from the font catalog (see fontOptionsFor),
   so it can only ever offer families the editor and codegen can both load.
   The list this replaced was hand-kept and had drifted: it offered
   "Editorial Sans" and "Neue Montreal", which are in no font source, so
   picking them changed nothing on the page. */
export const BRAND_FONTS_KEY = 'froam-brand-fonts-v1';
/** A woff2 is usually well under 100KB; this is generous but still loadable. */
export const BRAND_FONT_MAX_BYTES = 1_000_000;
export function loadBrandFonts(projectKey) {
    if (typeof window === 'undefined')
        return [];
    try {
        const raw = window.localStorage.getItem(froamStorageKey(BRAND_FONTS_KEY, projectKey));
        return raw ? sanitizeBrandFonts(JSON.parse(raw)) : [];
    }
    catch {
        return [];
    }
}
export function saveBrandFontsForProject(fonts, projectKey) {
    if (typeof window === 'undefined')
        return;
    try {
        window.localStorage.setItem(froamStorageKey(BRAND_FONTS_KEY, projectKey), JSON.stringify(fonts));
    }
    catch {
        // An uploaded face can be large enough to blow the quota. The design
        // matters more than the convenience copy, so fail quietly — the font
        // still lives in the design once it has been saved to the repo.
    }
}
export function loadStore(projectKey) {
    if (typeof window === 'undefined')
        return {};
    try {
        const raw = window.localStorage.getItem(froamStorageKey(STORAGE_KEY, projectKey));
        if (!raw)
            return {};
        return sanitizeStore(JSON.parse(raw));
    }
    catch {
        return {};
    }
}
export function saveStoreForProject(store, projectKey) {
    if (typeof window === 'undefined')
        return;
    const serialized = JSON.stringify(sanitizeStore(store));
    try {
        window.localStorage.setItem(froamStorageKey(STORAGE_KEY, projectKey), serialized);
    }
    catch {
        // History is disposable and the design is not. Clear both records of how
        // the design got here before risking the design itself.
        try {
            window.localStorage.removeItem(LEGACY_HISTORY_KEY);
        }
        catch { /* ignore */ }
        clearOpLog(projectKey);
        try {
            window.localStorage.setItem(froamStorageKey(STORAGE_KEY, projectKey), serialized);
        }
        catch {
            // Keep the in-memory editor usable even when persistence is unavailable.
        }
    }
}
export function loadNodeRegistry(projectKey) {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(froamStorageKey(NODE_REGISTRY_KEY, projectKey)) ?? '{}');
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    }
    catch {
        return {};
    }
}
export function saveNodeRegistryForProject(registry, projectKey) {
    try {
        const entries = Object.entries(registry)
            .sort(([, left], [, right]) => right.updatedAt - left.updatedAt)
            .slice(0, 5_000);
        window.localStorage.setItem(froamStorageKey(NODE_REGISTRY_KEY, projectKey), JSON.stringify(Object.fromEntries(entries)));
    }
    catch { /* private mode or quota pressure */ }
}
export function loadPersonaPreference() {
    if (typeof window === 'undefined')
        return DEFAULT_FROAM_PERSONA;
    try {
        const raw = window.localStorage.getItem(PERSONA_STORAGE_KEY);
        return raw ? sanitizeFroamPersona(JSON.parse(raw)) : DEFAULT_FROAM_PERSONA;
    }
    catch {
        return DEFAULT_FROAM_PERSONA;
    }
}
export function savePersonaPreference(persona) {
    if (typeof window === 'undefined')
        return;
    try {
        window.localStorage.setItem(PERSONA_STORAGE_KEY, JSON.stringify(sanitizeFroamPersona(persona)));
    }
    catch {
        // Keep editing usable even if profile persistence is unavailable.
    }
}
export function personasEqual(left, right) {
    return left.name === right.name
        && left.tagline === right.tagline
        && left.imageUrl === right.imageUrl;
}
export function stripPersonaDrafts(drafts) {
    const nextDrafts = { ...drafts };
    delete nextDrafts[FROAM_PERSONA_PATH];
    return nextDrafts;
}
export function withPersonaDraft(drafts, persona) {
    return {
        ...stripPersonaDrafts(drafts),
        [FROAM_PERSONA_PATH]: { text: JSON.stringify(sanitizeFroamPersona(persona)) },
    };
}
export function countRenderableDrafts(drafts) {
    return Object.keys(drafts).filter((path) => !isFroamPersonaPath(path)).length;
}
export function sanitizeStore(store) {
    const nextStore = {};
    for (const [route, drafts] of Object.entries(store)) {
        const nextDrafts = {};
        for (const [path, draft] of Object.entries(drafts ?? {})) {
            if (path === CANVAS_KEY || isSafeDraftPath(path)) {
                nextDrafts[path] = draft;
            }
        }
        if (Object.keys(nextDrafts).length) {
            nextStore[route] = nextDrafts;
        }
    }
    return nextStore;
}
//# sourceMappingURL=storage.js.map