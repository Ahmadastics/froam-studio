import type { FroamProjectDocument } from './types';
export declare const FROAM_LOCAL_PROJECT_INLINE_LIMIT = 1500000;
export type FroamStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type FroamLocalPersistenceResult = {
    mode: 'inline' | 'compact' | 'minimal' | 'memory-only';
    bytes: number;
    quotaRecovered: boolean;
};
/** A recovery snapshot only. IndexedDB and project files retain the complete intelligence history. */
export declare function compactProjectForLocalStorage(project: FroamProjectDocument, minimal?: boolean): FroamProjectDocument;
/** Never throws: quota failure degrades to a compact recovery document, then memory-only. */
export declare function persistProjectToLocalStorage(storage: FroamStorageLike, key: string, project: FroamProjectDocument): FroamLocalPersistenceResult;
export declare function loadProjectFromIndexedDb(projectId: string): Promise<FroamProjectDocument | null>;
/** Serialize writes per project so a slower older transaction cannot overwrite newer state. */
export declare function saveProjectToIndexedDb(project: FroamProjectDocument): Promise<boolean>;
//# sourceMappingURL=local-project-store.d.ts.map