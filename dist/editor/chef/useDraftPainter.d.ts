import { type ElementDraft } from './types';
type Ref<T> = {
    current: T;
};
export type UseDraftPainterOptions = {
    hasRouteDrafts: boolean;
    routeDrafts: Record<string, ElementDraft>;
    viewportStoreKey: string;
    suspendDraftPaintingRef: Ref<boolean>;
    applySectionStructure: (routeDraftsToApply: Record<string, ElementDraft>) => void;
    restoreInjectedBlocks: (routeDraftsToApply: Record<string, ElementDraft>) => void;
};
/**
 * Keeps this route's drafts on the page: painted once, then again whenever the
 * page's own DOM changes under them (React re-renders, late content). The
 * painter's own writes are not page changes — see draft-text.ts.
 */
export declare function useDraftPainter({ hasRouteDrafts, routeDrafts, viewportStoreKey, suspendDraftPaintingRef, applySectionStructure, restoreInjectedBlocks }: UseDraftPainterOptions): void;
export {};
//# sourceMappingURL=useDraftPainter.d.ts.map