import { type FroamArchiveItem, type FroamDNA, type FroamInteraction, type FroamNode } from './types';
export type FroamArchiveKind = NonNullable<FroamArchiveItem['kind']>;
export declare function archiveItemKind(item: FroamArchiveItem): FroamArchiveKind;
export declare function minimalArchiveDna(nodeId: string, input?: {
    role?: string;
    tagName?: string;
    styles?: Record<string, string>;
    motion?: FroamInteraction;
}): FroamDNA;
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
    kind?: FroamArchiveKind;
    description?: string;
    tags?: string[];
    styles?: Record<string, string>;
    interaction?: FroamInteraction;
    includes?: Array<'structure' | 'styles' | 'motion' | 'behavior'>;
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
export declare function recordArchiveArtifactUse(item: FroamArchiveItem, nodeId?: string, now?: number): FroamArchiveItem;
export declare function similarArchiveItems(archive: Record<string, FroamArchiveItem>): {
    left: string;
    right: string;
    confidence: number;
}[];
//# sourceMappingURL=archive.d.ts.map