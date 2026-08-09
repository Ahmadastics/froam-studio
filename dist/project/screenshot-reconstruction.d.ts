import type { FroamAnalysis, FroamDNA, FroamNode, FroamRelation } from './types';
export type FroamScreenshotReferenceMeta = {
    viewportWidth?: number;
    viewportHeight?: number;
    state?: string;
    route?: string;
    label?: string;
    realityResearch?: boolean;
    sourceWidth?: number;
    sourceHeight?: number;
    quad?: unknown;
    limitations?: string[];
};
export type FroamScreenshotPixels = {
    width: number;
    height: number;
    data: Uint8ClampedArray;
    mimeType: string;
    name?: string;
    referenceId?: string;
    metadata?: FroamScreenshotReferenceMeta;
};
export type FroamScreenshotReferenceSet = {
    references: FroamScreenshotPixels[];
    primaryReferenceId?: string;
};
export type FroamOcrLine = {
    id: string;
    text?: string;
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    confidence: number;
    uncertain?: boolean;
    lineBreakAfter?: boolean;
};
export type FroamOcrResult = {
    provider: string;
    available: boolean;
    lines: FroamOcrLine[];
    warnings: string[];
};
export interface FroamOcrProvider {
    id: string;
    local: boolean;
    available(): boolean;
    recognize(reference: FroamScreenshotPixels): Promise<FroamOcrResult>;
}
export type FroamScreenshotRegion = {
    id: string;
    nodeId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    kind: 'text' | 'image' | 'container';
    confidence: number;
    averageColor?: string;
    text?: string;
    textConfidence?: number;
    semanticRole?: 'heading' | 'paragraph' | 'label' | 'button' | 'unknown';
    componentFamilyId?: string;
};
export type FroamPixelMismatch = {
    x: number;
    y: number;
    width: number;
    height: number;
    meanError: number;
    category: 'color-or-image';
};
export type FroamVisualDiff = {
    metric: 'normalized-rgb-mae-v1';
    comparable: boolean;
    pixelSimilarity?: number;
    meanAbsoluteError?: number;
    largestMismatches: FroamPixelMismatch[];
    disclaimer: string;
};
export type FroamCorrectionPass = {
    pass: number;
    category: 'geometry';
    changedRegionIds: string[];
    remainingGeometryError: number;
};
export type FroamScreenshotReconstruction = {
    analysis: FroamAnalysis;
    nodes: FroamNode[];
    relations: FroamRelation[];
    dna: FroamDNA[];
    regions: FroamScreenshotRegion[];
    rootNodeId: string;
    references: Array<{
        id: string;
        metadata?: FroamScreenshotReferenceMeta;
        width: number;
        height: number;
    }>;
    ocr: FroamOcrResult[];
    correctionPasses: FroamCorrectionPass[];
};
export interface FroamScreenshotProvider {
    id: string;
    local: boolean;
    reconstruct(input: FroamScreenshotPixels | FroamScreenshotReferenceSet): Promise<FroamScreenshotReconstruction>;
}
export declare const browserTextDetectorOcrProvider: FroamOcrProvider;
export declare const unavailableOcrProvider: FroamOcrProvider;
export declare function compareScreenshotPixels(reference: FroamScreenshotPixels, candidate: FroamScreenshotPixels, tileSize?: number): FroamVisualDiff;
export declare function applyVisualDiff(reconstruction: FroamScreenshotReconstruction, diff: FroamVisualDiff): FroamScreenshotReconstruction;
export declare function boundedGeometryCorrection(regions: readonly FroamScreenshotRegion[], targets: readonly Pick<FroamScreenshotRegion, 'id' | 'x' | 'y' | 'width' | 'height'>[], maxPasses?: number): {
    regions: {
        id: string;
        nodeId: string;
        x: number;
        y: number;
        width: number;
        height: number;
        kind: "text" | "image" | "container";
        confidence: number;
        averageColor?: string;
        text?: string;
        textConfidence?: number;
        semanticRole?: "heading" | "paragraph" | "label" | "button" | "unknown";
        componentFamilyId?: string;
    }[];
    passes: FroamCorrectionPass[];
};
export declare function createLocalScreenshotProvider(ocrProvider?: FroamOcrProvider): FroamScreenshotProvider;
export declare const localScreenshotProvider: FroamScreenshotProvider;
//# sourceMappingURL=screenshot-reconstruction.d.ts.map