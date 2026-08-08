import type { FroamArchiveItem, FroamDNA, FroamNode } from './types';
export declare function createArchiveItem(input: {
    id: string;
    nodeId: string;
    name: string;
    actorId: string;
    projectId: string;
    branchId: string;
    dna: FroamDNA;
    html?: string;
    legacyPath?: string;
    assetIds?: string[];
    interactionIds?: string[];
    variantOf?: string;
    now?: number;
}): FroamArchiveItem;
export declare function upsertArchive(archive: Record<string, FroamArchiveItem>, item: FroamArchiveItem): {
    [x: string]: FroamArchiveItem;
};
export declare function removeFromArchive(archive: Record<string, FroamArchiveItem>, id: string): {
    [x: string]: FroamArchiveItem;
};
export declare function searchArchive(archive: Record<string, FroamArchiveItem>, query: string): FroamArchiveItem[];
export declare function reuseArchiveItem(item: FroamArchiveItem, input: {
    nodeId: string;
    parentId?: string | null;
    routeKey?: string;
    path?: string;
}): FroamNode;
export declare function recordArchiveUsage(item: FroamArchiveItem, nodeId: string): FroamArchiveItem;
export declare function similarArchiveItems(archive: Record<string, FroamArchiveItem>): {
    left: string;
    right: string;
    confidence: number;
}[];
//# sourceMappingURL=archive.d.ts.map