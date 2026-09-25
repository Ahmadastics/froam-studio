import { type GradientStop, type CSSVarEntry } from './types';
export declare function collectCSSVars(): CSSVarEntry[];
export declare function readCanvasState(): {
    background: string;
    text: string;
    imageUrl: string;
};
export declare function capturePageThumb(): Promise<string | null>;
export declare function syncFroamArtboardMetadata(element: HTMLElement): void;
export declare function buildGradientCSS(type: 'linear' | 'radial', angle: number, stops: GradientStop[]): string;
//# sourceMappingURL=canvas.d.ts.map