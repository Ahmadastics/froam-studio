import { type FroamChange } from '../../collab/oplog';
import { type FroamPersona } from '../froamPersona';
import { type ElementDraft, type ViewportMode } from './types';
/** "Fill · h1" — what changed, and on what. */
export declare function describeChange(change: FroamChange): string;
export declare function relativeTime(ts: number): string;
/**
 * Who and when. The local actor reads as "you" — an id is the right thing to
 * store and the wrong thing to show someone.
 */
export declare function changeByline(change: FroamChange): string;
export declare function smallHash(value: string): string;
export declare function describeImageSource(src: string): string;
export declare function parseInjectionDraft(draft: ElementDraft): {
    html: string;
    parentPath: string;
    order: number;
} | null;
export declare function compactText(value: string, max?: number): string;
export declare function buildFroamChangeReport(params: {
    routeKey: string;
    viewportMode: ViewportMode;
    viewportStoreKey: string;
    drafts: Record<string, ElementDraft>;
    persona: FroamPersona;
}): string;
//# sourceMappingURL=change-report.d.ts.map