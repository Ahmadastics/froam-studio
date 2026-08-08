import type { EditorStore, FroamActorId, FroamAnchorFingerprint, FroamOp, FroamViewport } from '../collab/types';
/** Schema version of the Connected Canvas project envelope (not the product version). */
export declare const FROAM_PROJECT_SCHEMA_VERSION: 2;
export declare const FROAM_DNA_SCHEMA_VERSION: 1;
export type FroamId = string;
export type FroamNodeKind = 'project' | 'page' | 'screen' | 'frame' | 'element' | 'component-definition' | 'component-instance' | 'asset' | 'state';
export type FroamNodeLocator = {
    /** Last-known legacy path. Kept while the runtime and codegen remain path-based. */
    path?: string;
    /** Recovery evidence for native host nodes whose structure moved. */
    fingerprint?: FroamAnchorFingerprint;
    routeKey?: string;
    viewport?: FroamViewport;
};
export type FroamNodeRef = FroamNodeLocator & {
    nodeId: FroamId;
};
export type FroamNode = {
    id: FroamId;
    kind: FroamNodeKind;
    name?: string;
    parentId?: FroamId | null;
    componentId?: FroamId | null;
    source: 'host-dom' | 'froam' | 'imported';
    locator?: FroamNodeLocator;
    metadata?: Record<string, unknown>;
};
export type FroamRelationKind = 'contains' | 'instance-of' | 'navigates-to' | 'transitions-to' | 'uses-asset' | 'derived-from' | 'variant-of' | 'belongs-to' | 'connected-to' | 'custom';
export type FroamRelation = {
    id: FroamId;
    kind: FroamRelationKind;
    from: FroamId;
    to: FroamId;
    label?: string;
    condition?: string;
    metadata?: Record<string, unknown>;
};
export type FroamTimelineKeyframe = {
    at: number;
    values: Record<string, string | number>;
    easing?: string;
};
export type FroamInteraction = {
    id: FroamId;
    name: string;
    sourceId: FroamId;
    targetIds: FroamId[];
    trigger: 'load' | 'hover' | 'press' | 'click' | 'focus' | 'scroll' | 'drag' | 'custom';
    fromState?: string;
    toState?: string;
    timeline: FroamTimelineKeyframe[];
    durationMs?: number;
    delayMs?: number;
    physics?: {
        preset?: string;
        stiffness?: number;
        damping?: number;
        mass?: number;
    };
    feedback?: {
        soundAssetId?: FroamId;
        haptic?: string;
    };
    metadata?: Record<string, unknown>;
};
export type FroamFlow = {
    id: FroamId;
    name: string;
    nodeIds: FroamId[];
    edgeIds: FroamId[];
    entryNodeId?: FroamId;
    metadata?: Record<string, unknown>;
};
export type FroamKnowledgeOrigin = 'observed' | 'inferred' | 'user-defined';
export type FroamKnowledge<T = unknown> = {
    value: T;
    origin: FroamKnowledgeOrigin;
    source: string;
    confidence?: number;
    capturedAt: number;
};
export type FroamSemanticRole = 'navigation' | 'button' | 'cta' | 'heading' | 'paragraph' | 'card' | 'form' | 'input' | 'hero' | 'footer' | 'list' | 'media' | 'badge' | 'modal' | 'menu' | 'unknown';
export type FroamScanSignalKind = 'identity' | 'structure' | 'layout' | 'appearance' | 'semantics' | 'behavior' | 'responsive' | 'accessibility' | 'provenance';
export type FroamScanSignal = {
    kind: FroamScanSignalKind;
    origin: FroamKnowledgeOrigin;
    source: 'dom' | 'computed-style' | 'react' | 'runtime' | 'import' | 'manual' | 'heuristic';
    values: Record<string, unknown>;
    confidence?: number;
};
export type FroamScanRecord = {
    schemaVersion: 1;
    id: FroamId;
    node: FroamNodeRef;
    capturedAt: number;
    signals: FroamScanSignal[];
    childNodeIds: FroamId[];
    siblingNodeIds: FroamId[];
};
export type FroamResponsivePriority = 'critical' | 'high' | 'medium' | 'low' | 'decorative';
export type FroamResponsivePolicy = {
    schemaVersion: 1;
    nodeId: FroamId;
    priority: FroamResponsivePriority;
    canHide: boolean;
    canCollapse: boolean;
    canWrap: boolean;
    canTruncate: boolean;
    canCrop: boolean;
    canReposition: boolean;
    minimumUsefulWidth?: number;
    minimumUsefulHeight?: number;
    preferredRelationship?: string;
    updatedAt: number;
    updatedBy: FroamActorId;
};
export type FroamDNA = {
    schemaVersion: typeof FROAM_DNA_SCHEMA_VERSION;
    nodeId: FroamId;
    capturedAt: number;
    identity?: Record<string, unknown>;
    structure?: Record<string, unknown>;
    layout?: Record<string, unknown>;
    visual?: Record<string, unknown>;
    semantics?: Record<string, unknown>;
    behavior?: Record<string, unknown>;
    motion?: Record<string, unknown>;
    responsive?: Record<string, unknown>;
    accessibility?: Record<string, unknown>;
    provenance?: Record<string, unknown>;
    history?: Record<string, unknown>;
    usage?: Record<string, unknown>;
    knowledge?: Record<string, FroamKnowledge>;
};
export type FroamArchiveItem = {
    schemaVersion: 1;
    id: FroamId;
    nodeId: FroamId;
    name: string;
    createdAt: number;
    createdBy: FroamActorId;
    snapshot?: {
        html?: string;
        legacyPath?: string;
        previewDataUrl?: string;
    };
    dna: FroamDNA;
    assetIds: FroamId[];
    interactionIds: FroamId[];
    variantOf?: FroamId;
    provenance: {
        projectId: FroamId;
        branchId: FroamId;
        sourceNodeId: FroamId;
    };
    usageNodeIds: FroamId[];
    metadata?: Record<string, unknown>;
};
export type FroamAnalysisKind = 'predicted-attention' | 'visual-rhythm' | 'responsive-observation' | 'screenshot-reconstruction';
export type FroamAnalysis = {
    schemaVersion: 1;
    id: FroamId;
    kind: FroamAnalysisKind;
    targetIds: FroamId[];
    createdAt: number;
    provider: string;
    local: boolean;
    confidence?: number;
    result: Record<string, unknown>;
};
export type FroamAsset = {
    id: FroamId;
    kind: 'image' | 'video' | 'audio' | 'font' | 'icon' | 'document' | 'other';
    name: string;
    url?: string;
    mimeType?: string;
    hash?: string;
    metadata?: Record<string, unknown>;
};
/** A materialized view. Events are canonical; this shape makes reads fast. */
export type FroamProjectState = {
    legacyStore: EditorStore;
    nodes: Record<FroamId, FroamNode>;
    relations: Record<FroamId, FroamRelation>;
    flows: Record<FroamId, FroamFlow>;
    interactions: Record<FroamId, FroamInteraction>;
    dna: Record<FroamId, FroamDNA>;
    assets: Record<FroamId, FroamAsset>;
    scans: Record<FroamId, FroamScanRecord>;
    archive: Record<FroamId, FroamArchiveItem>;
    analyses: Record<FroamId, FroamAnalysis>;
    responsive: Record<FroamId, FroamResponsivePolicy>;
};
export type FroamProjectEventType = 'design.store.replaced' | 'design.op.appended' | 'node.upserted' | 'node.removed' | 'relation.upserted' | 'relation.removed' | 'flow.upserted' | 'flow.removed' | 'interaction.upserted' | 'interaction.removed' | 'dna.captured' | 'asset.upserted' | 'asset.removed' | 'scan.captured' | 'archive.upserted' | 'archive.removed' | 'analysis.upserted' | 'analysis.removed' | 'responsive.upserted' | 'responsive.removed';
export type FroamProjectEventPayload = {
    store: EditorStore;
} | {
    op: FroamOp;
} | {
    node: FroamNode;
} | {
    nodeId: FroamId;
} | {
    relation: FroamRelation;
} | {
    relationId: FroamId;
} | {
    flow: FroamFlow;
} | {
    flowId: FroamId;
} | {
    interaction: FroamInteraction;
} | {
    interactionId: FroamId;
} | {
    dna: FroamDNA;
} | {
    asset: FroamAsset;
} | {
    assetId: FroamId;
} | {
    scan: FroamScanRecord;
} | {
    archiveItem: FroamArchiveItem;
} | {
    archiveItemId: FroamId;
} | {
    analysis: FroamAnalysis;
} | {
    analysisId: FroamId;
} | {
    responsive: FroamResponsivePolicy;
} | {
    nodeId: FroamId;
    remove: 'responsive';
};
export type FroamProjectEvent = {
    schemaVersion: typeof FROAM_PROJECT_SCHEMA_VERSION;
    id: FroamId;
    projectId: FroamId;
    branchId: FroamId;
    actorId: FroamActorId;
    clock: number;
    createdAt: number;
    type: FroamProjectEventType;
    targetIds: FroamId[];
    payload: FroamProjectEventPayload;
    batchId?: FroamId;
    label?: string;
};
export type FroamCheckpoint = {
    id: FroamId;
    projectId: FroamId;
    branchId: FroamId;
    createdAt: number;
    createdBy: FroamActorId;
    label?: string;
    /** Events already folded into state. Late events remain detectable and replayable. */
    eventIds: FroamId[];
    state: FroamProjectState;
    parentCheckpointId?: FroamId | null;
};
export type FroamBranch = {
    id: FroamId;
    name: string;
    parentBranchId: FroamId | null;
    forkEventId: FroamId | null;
    baseCheckpointId: FroamId;
    headEventId: FroamId | null;
    createdAt: number;
    createdBy: FroamActorId;
    /** Earliest reconstructable state for complete branch replay. */
    rootCheckpointId?: FroamId;
};
export type FroamProjectDocument = {
    schemaVersion: typeof FROAM_PROJECT_SCHEMA_VERSION;
    id: FroamId;
    name: string;
    activeBranchId: FroamId;
    createdAt: number;
    updatedAt: number;
    branches: Record<FroamId, FroamBranch>;
    checkpoints: Record<FroamId, FroamCheckpoint>;
    events: FroamProjectEvent[];
    metadata?: Record<string, unknown>;
};
//# sourceMappingURL=types.d.ts.map