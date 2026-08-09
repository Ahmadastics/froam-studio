import type { FroamScreenshotPixels } from './screenshot-reconstruction';
export type FroamScreenQuad = {
    topLeft: {
        x: number;
        y: number;
    };
    topRight: {
        x: number;
        y: number;
    };
    bottomRight: {
        x: number;
        y: number;
    };
    bottomLeft: {
        x: number;
        y: number;
    };
    confidence: number;
    method: 'manual' | 'gradient-bounds-v1';
};
export declare function detectProbableScreenRegion(photo: FroamScreenshotPixels): FroamScreenQuad | null;
export declare function rectifyScreenRegion(photo: FroamScreenshotPixels, quad: FroamScreenQuad, width: number, height: number): FroamScreenshotPixels;
//# sourceMappingURL=reality.d.ts.map