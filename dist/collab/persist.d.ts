import { type FroamOp } from './types';
export declare const FROAM_OPLOG_KEY = "froam-oplog-v1";
export declare function loadOpLog(): FroamOp[];
export declare function clearOpLog(): void;
/**
 * Persist the log, trading history for space as needed.
 *
 * Returns the ops that actually made it to storage. The caller should adopt
 * that list, so the in-memory log gets the same compaction and doesn't grow
 * forever in a long editing session.
 */
export declare function saveOpLog(ops: readonly FroamOp[]): FroamOp[];
//# sourceMappingURL=persist.d.ts.map