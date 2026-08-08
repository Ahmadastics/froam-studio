import { type Dispatch, type SetStateAction } from 'react';
import type { EditorStore, FroamOp } from '../collab/types';
import type { FroamProjectDocument } from '../project/types';
export type FroamProjectSession = {
    project: FroamProjectDocument;
    setProject: Dispatch<SetStateAction<FroamProjectDocument>>;
};
export declare function useFroamProjectDocument(input: {
    projectId: string;
    actorId: string;
    ops: readonly FroamOp[];
    store: EditorStore;
    revision?: number;
}): FroamProjectSession;
//# sourceMappingURL=useFroamProjectDocument.d.ts.map