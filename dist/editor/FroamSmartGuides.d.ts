type GuideAxis = 'x' | 'y';
export type AlignmentGuide = {
    axis: GuideAxis;
    position: number;
    start: number;
    end: number;
    type: 'edge' | 'center';
};
type Props = {
    guides: AlignmentGuide[];
    visible: boolean;
};
/**
 * Compute alignment guides between a moving element rect and a list of sibling rects.
 * Returns guide lines where edges or centers align.
 */
export declare function computeAlignmentGuides(movingRect: DOMRect, siblingRects: DOMRect[], threshold?: number): {
    guides: AlignmentGuide[];
    snapX: number | null;
    snapY: number | null;
};
/**
 * Get bounding rects of all sibling elements in the same parent,
 * excluding the moving element itself and editor UI elements.
 */
export declare function getSiblingRects(movingElement: HTMLElement): DOMRect[];
export default function FroamSmartGuides({ guides, visible }: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=FroamSmartGuides.d.ts.map