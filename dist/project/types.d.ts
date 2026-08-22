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
export type FroamRelationKind = 'contains' | 'instance-of' | 'navigates-to' | 'transitions-to' | 'uses-asset' | 'derived-from' | 'variant-of' | 'belongs-to' | 'connected-to' | 'mutated-from' | 'uses-interaction' | 'sampled-from' | 'governed-by' | 'tested-by' | 'performed-by' | 'uses-sound' | 'custom';
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
        friction?: number;
        bounce?: number;
        velocity?: number;
        resistance?: number;
        attraction?: number;
    };
    feedback?: {
        soundAssetId?: FroamId;
        soundOffsetMs?: number;
        volume?: number;
        pitch?: number;
        haptic?: 'light' | 'medium' | 'heavy' | 'success';
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
    /** v1 items deserialize as components. v2 adds portable non-DOM artifacts. */
    schemaVersion: 1 | 2;
    id: FroamId;
    nodeId: FroamId;
    name: string;
    kind?: 'component' | 'style' | 'motion' | 'interaction' | 'interface-pattern';
    description?: string;
    tags?: string[];
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
    artifact?: {
        styles?: Record<string, string>;
        interaction?: FroamInteraction;
        interactionIds?: FroamId[];
        includes?: Array<'structure' | 'styles' | 'motion' | 'behavior'>;
    };
    metadata?: Record<string, unknown>;
};
export type FroamAnalysisKind = 'predicted-attention' | 'visual-rhythm' | 'responsive-observation' | 'screenshot-reconstruction' | 'chaos-result' | 'synthetic-ux-run' | 'trailer-storyboard' | 'sampling-session';
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
export type FroamDesignModeKind = 'base' | 'light' | 'dark' | 'mobile' | 'brand' | 'custom';
export type FroamStyleState = 'base' | 'hover' | 'focus' | 'active';
export type FroamDesignMode = {
    id: FroamId;
    name: string;
    kind: FroamDesignModeKind;
    parentId?: FroamId;
    viewport?: FroamViewport;
    brand?: string;
    createdAt: number;
};
export type FroamDesignVariable = {
    id: FroamId;
    name: string;
    cssName: string;
    kind: 'color' | 'size' | 'number' | 'font' | 'shadow' | 'string';
    role: 'primitive' | 'semantic';
    collection: string;
    values: Record<FroamId, string>;
    aliasTo?: FroamId;
    description?: string;
};
export type FroamReusableStyle = {
    id: FroamId;
    name: string;
    category: string;
    states: Partial<Record<FroamStyleState, Record<string, string>>>;
    variableBindings?: Record<string, FroamId>;
    usageNodeIds: FroamId[];
    createdAt: number;
    updatedAt: number;
    version: number;
};
export type FroamComponentProp = {
    id: FroamId;
    name: string;
    kind: 'text' | 'image' | 'link' | 'boolean' | 'number' | 'slot';
    defaultValue?: string | number | boolean;
    required?: boolean;
};
export type FroamComponentVariant = {
    id: FroamId;
    name: string;
    styles?: Record<string, string>;
    slotDefaults?: Record<string, FroamId[]>;
    propDefaults?: Record<string, string | number | boolean>;
};
export type FroamComponentFamily = {
    id: FroamId;
    name: string;
    category: string;
    baseComponentId: FroamId;
    props: FroamComponentProp[];
    slots: Array<{
        id: FroamId;
        name: string;
        accepts?: string[];
    }>;
    variants: FroamComponentVariant[];
    createdAt: number;
    updatedAt: number;
    version: number;
};
export type FroamSiteKit = {
    id: FroamId;
    name: string;
    description: string;
    modeIds: FroamId[];
    variableIds: FroamId[];
    styleIds: FroamId[];
    componentFamilyIds: FroamId[];
    interactionIds: FroamId[];
    tags: string[];
    createdAt: number;
    updatedAt: number;
    version: number;
};
export type FroamLibraryRelease = {
    version: number;
    createdAt: number;
    variableIds: FroamId[];
    styleIds: FroamId[];
    componentFamilyIds: FroamId[];
    siteKitIds: FroamId[];
    notes?: string;
};
export type FroamLibrary = {
    id: FroamId;
    name: string;
    sourceProjectId: FroamId;
    installedVersion: number;
    availableVersion: number;
    status: 'current' | 'update-available' | 'postponed';
    releases: FroamLibraryRelease[];
    createdAt: number;
    updatedAt: number;
};
export type FroamDesignSystem = {
    schemaVersion: 1;
    activeModeIds: FroamId[];
    modes: Record<FroamId, FroamDesignMode>;
    variables: Record<FroamId, FroamDesignVariable>;
    styles: Record<FroamId, FroamReusableStyle>;
    componentFamilies: Record<FroamId, FroamComponentFamily>;
    siteKits: Record<FroamId, FroamSiteKit>;
    libraries: Record<FroamId, FroamLibrary>;
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
    designSystem: FroamDesignSystem;
};
export type FroamProjectEventType = 'design.store.replaced' | 'design.op.appended' | 'node.upserted' | 'node.removed' | 'relation.upserted' | 'relation.removed' | 'flow.upserted' | 'flow.removed' | 'interaction.upserted' | 'interaction.removed' | 'dna.captured' | 'asset.upserted' | 'asset.removed' | 'scan.captured' | 'archive.upserted' | 'archive.removed' | 'analysis.upserted' | 'analysis.removed' | 'responsive.upserted' | 'responsive.removed' | 'design-system.replaced';
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
} | {
    designSystem: FroamDesignSystem;
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