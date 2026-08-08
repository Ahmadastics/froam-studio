import type { FroamAnalysis, FroamDNA, FroamNode, FroamRelation } from './types';
export type FroamScreenshotPixels = {
    width: number;
    height: number;
    data: Uint8ClampedArray;
    mimeType: string;
    name?: string;
};
export type FroamScreenshotRegion = {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    kind: 'text' | 'image' | 'container';
    confidence: number;
    averageColor?: string;
};
export type FroamScreenshotReconstruction = {
    analysis: FroamAnalysis;
    nodes: FroamNode[];
    relations: FroamRelation[];
    dna: FroamDNA[];
    regions: FroamScreenshotRegion[];
};
export interface FroamScreenshotProvider {
    id: string;
    local: boolean;
    reconstruct(input: FroamScreenshotPixels): Promise<FroamScreenshotReconstruction>;
}
export declare const localScreenshotProvider: FroamScreenshotProvider;
//# sourceMappingURL=screenshot-reconstruction.d.ts.map