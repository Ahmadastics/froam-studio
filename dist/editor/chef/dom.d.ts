import { type SelectionState } from './types';
export declare function getRoot(): HTMLElement | null;
export declare function getCanvasHost(): HTMLElement | null;
export declare function applyGlobalCSS(css?: string): void;
export declare const SVG_NS = "http://www.w3.org/2000/svg";
/** An element inside an <svg> (path, g, circle…) — edited through its <svg>. */
export declare function isSvgInternal(element: Element): boolean;
export declare function shouldSkipElement(element: HTMLElement): boolean;
export declare function readNumber(value: string, fallback: number): number;
export declare function camelToKebab(str: string): string;
export declare function readCssUrl(value: string): string | null;
export declare function parseTransformValues(transformStr: string): {
    rotate: number;
    scaleX: number;
    scaleY: number;
    skewX: number;
    skewY: number;
    translateX: number;
    translateY: number;
};
export declare function rgbToHex(value: string): string;
export declare function readImageUrl(value: string): string;
export declare function buildSelection(element: HTMLElement, path: string): SelectionState;
//# sourceMappingURL=dom.d.ts.map