import { jsx as _jsx } from "react/jsx-runtime";
/**
 * Froam Review — notes, pinned to the thing they are about.
 *
 * A note in a list is feedback. A note stuck to the element it concerns is an
 * instruction, and the difference is most of the value — so every note is
 * resolved back onto the page through the anchor resolver from 0.3 rather than
 * through its path alone.
 *
 * When a note cannot be placed it is not dropped and it is not guessed at. It
 * is reported as orphaned so the list can still show it, because a client's
 * feedback quietly pointing at nothing is worse than feedback nobody acted on.
 */
import { useCallback, useEffect, useState } from 'react';
import { resolveAnchor } from '../collab/anchor.js';
/**
 * Where each note sits right now.
 *
 * Recomputed on scroll and resize rather than tracked per element: a page
 * being actively redesigned moves under these constantly, and one pass over a
 * handful of notes is cheaper than a per-element observer that has to be torn
 * down every time the design repaints.
 */
export function usePlacedNotes(notes, root) {
    const [placed, setPlaced] = useState([]);
    const measure = useCallback(() => {
        if (!root) {
            setPlaced(notes.map((note, i) => ({ note, index: i + 1, rect: null, orphaned: true, recovered: false })));
            return;
        }
        setPlaced(notes.map((note, i) => {
            const resolution = resolveAnchor(note.anchor, root);
            if (resolution.status === 'orphaned') {
                return { note, index: i + 1, rect: null, orphaned: true, recovered: false };
            }
            const box = resolution.element.getBoundingClientRect();
            return {
                note,
                index: i + 1,
                // Viewport coordinates: the pins live in a fixed layer, so they do not
                // inherit whatever transforms the page has been given.
                rect: { top: box.top, left: box.left + box.width },
                orphaned: false,
                recovered: resolution.status === 'recovered',
            };
        }));
    }, [notes, root]);
    useEffect(() => {
        measure();
        const onMove = () => measure();
        window.addEventListener('scroll', onMove, true);
        window.addEventListener('resize', onMove);
        return () => {
            window.removeEventListener('scroll', onMove, true);
            window.removeEventListener('resize', onMove);
        };
    }, [measure]);
    return { placed, remeasure: measure };
}
export default function FroamNotePins({ notes, root, activeId, onPick, }) {
    const { placed } = usePlacedNotes(notes, root);
    const visible = placed.filter((p) => p.rect && !p.note.resolved);
    if (!visible.length)
        return null;
    return (_jsx("div", { className: "froam-pins", "data-chef-editor-root": "true", "aria-hidden": false, children: visible.map(({ note, index, rect, recovered }) => (_jsx("button", { type: "button", className: `froam-pin${activeId === note.id ? ' is-active' : ''}${recovered ? ' is-recovered' : ''}`, style: { top: `${rect.top}px`, left: `${rect.left}px` }, title: recovered
                ? `${note.name}: ${note.body}\n\n(this element moved — the note followed it)`
                : `${note.name}: ${note.body}`, onClick: () => onPick?.(note), children: index }, note.id))) }));
}
//# sourceMappingURL=FroamNotePins.js.map