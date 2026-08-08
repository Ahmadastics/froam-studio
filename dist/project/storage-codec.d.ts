import type { FroamProjectDocument } from './types';
export type FroamBlobRef = {
    $froamBlob: number;
};
export type FroamPackedProject = {
    kind: 'froam-packed-project';
    version: 1;
    projectId: string;
    root: unknown;
    blobIds: string[];
    blobs: unknown[];
    projections?: {
        checkpointDnaFromScans: Record<string, string[]>;
    };
};
export type FroamProjectSizeProfile = {
    totalBytes: number;
    categories: Record<string, number>;
    duplicateStringBytes: number;
    duplicatedStrings: number;
    packedBytes: number;
    reductionPercent: number;
};
/** Content-addressed storage only: unpacking must reproduce the exact canonical event document. */
export declare function packProjectDocument(project: FroamProjectDocument, thresholdBytes?: number): FroamPackedProject;
export declare function unpackProjectDocument(packed: FroamPackedProject): FroamProjectDocument;
export declare function profileProjectSize(project: FroamProjectDocument): FroamProjectSizeProfile;
//# sourceMappingURL=storage-codec.d.ts.map