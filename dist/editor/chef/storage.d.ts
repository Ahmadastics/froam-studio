import { type FroamNodeRegistry } from '../../project/node-registry';
import { type BrandFont } from '../fontSources';
import { type FroamPersona } from '../froamPersona';
import { type ElementDraft, type EditorStore } from './types';
export declare const STORAGE_KEY = "froam-editor-store-v1";
export declare const NODE_REGISTRY_KEY = "froam-node-registry-v1";
/** Retired in 4.9.4 — history is the op log now. Kept only to clear it. */
export declare const LEGACY_HISTORY_KEY = "froam-history-v1";
export declare const MAX_INLINE_ASSET_LENGTH = 40000;
export declare const MAX_PERSONA_IMAGE_BYTES = 400000;
export declare const SAVE_META_KEY = "froam-last-save-v1";
export declare const BRAND_FONTS_KEY = "froam-brand-fonts-v1";
/** A woff2 is usually well under 100KB; this is generous but still loadable. */
export declare const BRAND_FONT_MAX_BYTES = 1000000;
export declare function loadBrandFonts(projectKey: string): BrandFont[];
export declare function saveBrandFontsForProject(fonts: BrandFont[], projectKey: string): void;
export declare function loadStore(projectKey: string): EditorStore;
export declare function saveStoreForProject(store: EditorStore, projectKey: string): void;
export declare function loadNodeRegistry(projectKey: string): FroamNodeRegistry;
export declare function saveNodeRegistryForProject(registry: FroamNodeRegistry, projectKey: string): void;
export declare function loadPersonaPreference(): FroamPersona;
export declare function savePersonaPreference(persona: FroamPersona): void;
export declare function personasEqual(left: FroamPersona, right: FroamPersona): boolean;
export declare function stripPersonaDrafts(drafts: Record<string, ElementDraft>): {
    [x: string]: ElementDraft;
};
export declare function withPersonaDraft(drafts: Record<string, ElementDraft>, persona: FroamPersona): {
    "__froam_persona__:profile": {
        text: string;
    };
};
export declare function countRenderableDrafts(drafts: Record<string, ElementDraft>): number;
export declare function sanitizeStore(store: EditorStore): EditorStore;
//# sourceMappingURL=storage.d.ts.map