type Props = {
    /** The selected element, or null. */
    selection: HTMLElement | null;
    /** The editable page's root; only its elements are measured. */
    root: () => HTMLElement | null;
    enabled: boolean;
};
type Line = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    value: number;
};
type Rect = {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
};
/** Lines between two boxes, the way design tools draw them. */
export declare function measureBetween(a: Rect, b: Rect): Line[];
export default function FroamRedlines({ selection, root, enabled }: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=FroamRedlines.d.ts.map