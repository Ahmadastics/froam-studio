export type SpacingKind = 'padding' | 'margin' | 'gap';
type Props = {
    target: HTMLElement | null;
    /** Changes whenever the selection moves or reflows; the handles re-measure on it. */
    rect: DOMRect | null;
    visible: boolean;
    /** Before the first pixel moves: lock, remember originals. Return false to refuse. */
    onStart: () => boolean;
    /** Live: write these styles straight onto the element. */
    onPreview: (styles: Record<string, string>) => void;
    /** Pointer up: commit what the drag ended on. */
    onCommit: (styles: Record<string, string>, label: string) => void;
};
/**
 * The spacing values this page repeats. Reads padding, margin and gap off
 * up to 1,500 visible elements and keeps the values used three or more
 * times. A page with no clear rhythm gets a 4/8 scale instead.
 */
export declare function pageRhythm(root?: ParentNode): number[];
/** Pull `value` onto the scale when it's within reach; report whether it landed on it. */
export declare function snapToRhythm(value: number, scale: readonly number[], reach?: number): {
    value: number;
    snapped: boolean;
};
export default function FroamSpacingHandles({ target, rect, visible, onStart, onPreview, onCommit }: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=FroamSpacingHandles.d.ts.map