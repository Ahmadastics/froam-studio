import type { FroamOcrResult, FroamScreenshotPixels, FroamScreenshotReconstruction, FroamScreenshotRegion, FroamVisualDiff } from './screenshot-reconstruction';
export type FroamScreenshotChallenge = 'gradient' | 'overlap' | 'transparency' | 'large-type' | 'icon-only' | 'card-grid' | 'nested-cards' | 'navigation' | 'modal' | 'dark-mode' | 'light-mode' | 'unusual-font' | 'image-heavy' | 'small-text' | 'low-contrast' | 'responsive';
export type FroamScreenshotCorpusCase = {
    id: string;
    reference: FroamScreenshotPixels;
    viewport: {
        width: number;
        height: number;
    };
    route?: string;
    state?: string;
    expectedText?: string[];
    expectedRegions?: Array<Pick<FroamScreenshotRegion, 'kind' | 'x' | 'y' | 'width' | 'height'>>;
    expectedStructure?: {
        groups?: number;
        repeatedFamilies?: number;
    };
    tags?: FroamScreenshotChallenge[];
};
export type FroamScreenshotQualityMetrics = {
    text: {
        expected: number;
        matched: number;
        accuracy?: number;
        meanConfidence?: number;
    };
    geometry: {
        compared: number;
        meanIoU?: number;
        meanPositionError?: number;
        meanDimensionError?: number;
    };
    structure: {
        expectedGroups?: number;
        observedGroups: number;
        expectedRepeatedFamilies?: number;
        observedRepeatedFamilies: number;
    };
    visual: {
        pixel?: FroamVisualDiff;
        colorCoverage: number;
        typographyApproximation: 'not-measured';
    };
    timingMs: number;
    limitations: string[];
};
export type FroamScreenshotCorpusResult = {
    caseId: string;
    reconstruction: FroamScreenshotReconstruction;
    ocr: FroamOcrResult[];
    metrics: FroamScreenshotQualityMetrics;
};
export declare function evaluateScreenshotReconstruction(testCase: FroamScreenshotCorpusCase, reconstruction: FroamScreenshotReconstruction, input: {
    visualDiff?: FroamVisualDiff;
    timingMs: number;
}): FroamScreenshotQualityMetrics;
export declare function runScreenshotCorpus(cases: readonly FroamScreenshotCorpusCase[], reconstruct: (reference: FroamScreenshotPixels) => Promise<FroamScreenshotReconstruction>): Promise<FroamScreenshotCorpusResult[]>;
//# sourceMappingURL=screenshot-evaluation.d.ts.map