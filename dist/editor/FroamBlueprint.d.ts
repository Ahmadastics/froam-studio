type BlueprintCategory = 'heading' | 'media' | 'action' | 'container' | 'text';
export type BlueprintNode = {
    el: HTMLElement;
    x: number;
    y: number;
    w: number;
    h: number;
    category: BlueprintCategory;
    label: string;
    /** DOM nesting depth, normalised so the shallowest captured node is 0 (drives the 3D lift). */
    depth: number;
};
type Callout = {
    node: BlueprintNode;
    title: string;
};
export type BlueprintData = {
    nodes: BlueprintNode[];
    docWidth: number;
    docHeight: number;
    counts: Record<BlueprintCategory, number>;
    callouts: Callout[];
    gutter: number;
    palette: string[];
    fonts: string[];
    title: string;
    stamp: string;
    reduceMotion: boolean;
    /** Deepest normalised nesting level across all nodes (0 = flat page). */
    maxDepth: number;
};
/** Scan the live page and produce the full blueprint dataset (or null if empty). */
export declare function computeBlueprintData(root: HTMLElement | null): BlueprintData | null;
export declare const BLUEPRINT_CATEGORY_COLOR: Record<BlueprintCategory, string>;
export declare const BLUEPRINT_CATEGORY_LABEL: Record<BlueprintCategory, string>;
/**
 * The drawn sheet itself: blueprint paper, grid, and a stroke-drawn wireframe
 * of every element at true document scale. `mode="full"` adds labels, callouts
 * and click-to-select; `mode="mini"` is the compact full-page picture used in
 * the Prototype tab (whole sheet handles the click via its parent).
 */
export declare function BlueprintSheet({ data, mode, onJumpToElement, }: {
    data: BlueprintData;
    mode?: 'full' | 'mini';
    onJumpToElement?: (element: HTMLElement) => void;
}): import("react").JSX.Element;
type Props = {
    open: boolean;
    onClose: () => void;
    routeKey: string;
    getRootEl: () => HTMLElement | null;
    onJumpToElement: (element: HTMLElement) => void;
};
export default function FroamBlueprint({ open, onClose, routeKey, getRootEl, onJumpToElement }: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=FroamBlueprint.d.ts.map