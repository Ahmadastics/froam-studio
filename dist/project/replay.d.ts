import type { FroamProjectDocument, FroamProjectEvent, FroamProjectState } from './types';
export type FroamReplayCategory = 'structural' | 'styling' | 'text' | 'interaction' | 'other';
export type FroamReplayFilter = {
    actorId?: string;
    category?: FroamReplayCategory;
    includeBaseline?: boolean;
};
export declare function replayCategory(event: FroamProjectEvent): FroamReplayCategory;
export declare function filterReplayEvents(events: readonly FroamProjectEvent[], filter?: FroamReplayFilter): FroamProjectEvent[];
export declare function branchReplayEvents(document: FroamProjectDocument, branchId?: string, filter?: FroamReplayFilter): FroamProjectEvent[];
/** Fold to a cursor without mutating the project. Checkpoints make the initial state cheap. */
export declare function replayStateAt(document: FroamProjectDocument, cursor: number, branchId?: string, filter?: FroamReplayFilter): FroamProjectState;
export declare function replayActors(events: readonly FroamProjectEvent[]): string[];
export declare function replayEventLabel(event: FroamProjectEvent): string;
//# sourceMappingURL=replay.d.ts.map