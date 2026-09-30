import { type ElementDraft } from './types';
export declare function sanitizeDraftForElement(element: HTMLElement, draft: ElementDraft): ElementDraft;
/**
 * Take Froam's styles off an element: back to the style attribute the site
 * gave it. For an element Froam hasn't seen being painted (the page replaced
 * it since), only the properties in `styles` — Froam's — are removed.
 */
export declare function restorePageStyle(element: HTMLElement, styles?: Record<string, string>): void;
export declare function applyDraft(element: HTMLElement, draft: ElementDraft): void;
export declare function isInjectionPath(path: string): boolean;
export declare function isSectionStructurePath(path: string): path is "__froam_structure__:sections";
export declare function readInjectionDraft(draft: ElementDraft): {
    html: string;
    parentPath: string;
    parentId: string | undefined;
    order: number;
} | null;
export declare function readLiveElementDraft(element: HTMLElement, existingDraft?: ElementDraft): ElementDraft;
export declare function applyCanvasDraftStyles(background?: string, color?: string, styles?: Record<string, string>): void;
export declare function clearCanvasDraftStyles(): void;
//# sourceMappingURL=drafts.d.ts.map