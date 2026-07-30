import type { RoomComment } from '../collab/room';
export type PlacedNote = {
    note: RoomComment;
    index: number;
    rect: {
        top: number;
        left: number;
    } | null;
    /** True when the element it was left on can no longer be found. */
    orphaned: boolean;
    recovered: boolean;
};
/**
 * Where each note sits right now.
 *
 * Recomputed on scroll and resize rather than tracked per element: a page
 * being actively redesigned moves under these constantly, and one pass over a
 * handful of notes is cheaper than a per-element observer that has to be torn
 * down every time the design repaints.
 */
export declare function usePlacedNotes(notes: RoomComment[], root: HTMLElement | null): {
    placed: PlacedNote[];
    remeasure: () => void;
};
export default function FroamNotePins({ notes, root, activeId, onPick, }: {
    notes: RoomComment[];
    root: HTMLElement | null;
    activeId?: string | null;
    onPick?: (note: RoomComment) => void;
}): import("react").JSX.Element | null;
//# sourceMappingURL=FroamNotePins.d.ts.map