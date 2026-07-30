import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Froam Review — the client's side of a session.
 *
 * Everything here follows one rule from fig. 0.4: **the site is the hero and
 * Froam is a bar at the bottom.** If the first thing a client sees is a review
 * tool, they will think the review tool is the thing you built. They should
 * see their own page, looking finished, with one quiet line saying why they
 * are here — and that line names a person, not a product.
 *
 * Mounted by FroamRuntime, which otherwise renders nothing. Without an invite
 * in the URL none of this exists.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFroamRoom } from '../collab/useFroamRoom.js';
import { ROOM_PARAM, TOKEN_PARAM } from '../collab/room.js';
import { createAnchor } from '../collab/anchor.js';
/** Carry the invite across a navigation, or the next page is not a session. */
function urlForRoute(routeKey) {
    const url = new URL(window.location.href);
    const room = url.searchParams.get(ROOM_PARAM);
    const token = url.searchParams.get(TOKEN_PARAM);
    const next = new URL(routeKey, window.location.origin);
    if (room)
        next.searchParams.set(ROOM_PARAM, room);
    if (token)
        next.searchParams.set(TOKEN_PARAM, token);
    return next.toString();
}
export default function FroamReview({ routeKey, viewport }) {
    const room = useFroamRoom({ where: { routeKey, viewport } });
    const [name, setName] = useState('');
    const [asking, setAsking] = useState(false);
    const [paused, setPaused] = useState(false);
    const [movingTo, setMovingTo] = useState(null);
    const [commenting, setCommenting] = useState(false);
    const [draft, setDraft] = useState(null);
    const [sending, setSending] = useState(false);
    const [notes, setNotes] = useState([]);
    const canComment = room.role === 'commenter' || room.role === 'owner' || room.role === 'editor';
    // Read inside the tap handler without re-subscribing it on every keystroke.
    const draftRef = useRef(draft);
    draftRef.current = draft;
    /**
     * Comment mode is a *mode*, and this is why.
     *
     * On a phone, tapping to leave a note and tapping to follow a link are the
     * same gesture. So while the banner is up we take the tap: the link does not
     * fire, and a note is attached to whatever was under the finger instead.
     * Capture phase, because the page's own handlers must never see it.
     */
    useEffect(() => {
        if (!commenting)
            return;
        const root = document.querySelector('[data-froam-root]') ?? document.body;
        const take = (event) => {
            // elementFromPoint, not event.target: it gives the element actually under
            // the finger. A note anchored to a wrapper quotes the whole page back at
            // you and tells the designer nothing about what you meant.
            const under = (event.clientX || event.clientY)
                ? document.elementFromPoint(event.clientX, event.clientY)
                : event.target;
            const target = under ?? event.target;
            if (!target || target.closest('[data-chef-editor-root]'))
                return;
            if (!root.contains(target) || target === root)
                return;
            // Swallow every tap for as long as the mode is on, including the click
            // that follows the pointerdown which opened the sheet. Tearing the
            // listeners down the moment a draft exists let that click through to the
            // link underneath — the sheet opened *and* the page navigated, which is
            // the exact collision this mode exists to prevent.
            event.preventDefault();
            event.stopPropagation();
            // One note at a time: the tap that opened the sheet must not also
            // re-anchor it out from under whoever is typing.
            if (draftRef.current)
                return;
            const quoted = (target.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
            setDraft({ anchor: createAnchor(target, root), quoted, body: '' });
        };
        document.addEventListener('pointerdown', take, true);
        document.addEventListener('pointerup', take, true);
        document.addEventListener('click', take, true);
        return () => {
            document.removeEventListener('pointerdown', take, true);
            document.removeEventListener('pointerup', take, true);
            document.removeEventListener('click', take, true);
        };
    }, [commenting]);
    /** Opening the sheet pauses following — you asked for that, and it is right:
     *  being navigated away mid-sentence loses the note. */
    useEffect(() => {
        if (commenting || draft)
            setPaused(true);
    }, [commenting, draft]);
    const presenter = room.presenter;
    const following = room.someoneElseIsPresenting && !paused;
    /**
     * Following breaks the moment they do anything for themselves. No fight over
     * the scroll position, no being dragged away mid-thought — it is a courtesy,
     * never a cage.
     */
    useEffect(() => {
        if (!room.inRoom || paused)
            return;
        const release = () => setPaused(true);
        window.addEventListener('wheel', release, { passive: true });
        window.addEventListener('touchmove', release, { passive: true });
        window.addEventListener('pointerdown', release);
        return () => {
            window.removeEventListener('wheel', release);
            window.removeEventListener('touchmove', release);
            window.removeEventListener('pointerdown', release);
        };
    }, [room.inRoom, paused]);
    /**
     * Follow the presenter's route — never their viewport. They are on a desktop
     * and this is a phone; Froam keeps a design per viewport, so pushing theirs
     * would show a layout that was never meant for this hand.
     */
    useEffect(() => {
        if (!following || !presenter?.routeKey)
            return;
        if (presenter.routeKey === routeKey) {
            setMovingTo(null);
            return;
        }
        // Narrate first. Being teleported with no explanation is the worst moment
        // in any shared-screen tool, so the move is announced and then made.
        setMovingTo(presenter.routeKey);
        const timer = window.setTimeout(() => {
            window.location.assign(urlForRoute(presenter.routeKey));
        }, 1200);
        return () => window.clearTimeout(timer);
    }, [following, presenter?.routeKey, routeKey]);
    const refreshNotes = useCallback(async () => {
        if (!room.client)
            return;
        try {
            setNotes(await room.client.comments(routeKey, viewport));
        }
        catch { /* offline */ }
    }, [room.client, routeKey, viewport]);
    useEffect(() => { void refreshNotes(); }, [refreshNotes]);
    const send = useCallback(async () => {
        if (!draft || !room.client)
            return;
        setSending(true);
        try {
            await room.client.comment({
                routeKey,
                viewport,
                anchor: draft.anchor,
                quoted: draft.quoted || null,
                body: draft.body.trim(),
            });
            setDraft(null);
            await refreshNotes();
        }
        finally {
            setSending(false);
        }
    }, [draft, room.client, routeKey, viewport, refreshNotes]);
    const submit = useCallback(async () => {
        const trimmed = name.trim();
        if (!trimmed)
            return;
        await room.join(trimmed);
        setAsking(false);
    }, [name, room]);
    const label = useMemo(() => {
        if (movingTo)
            return `${presenter?.name ?? 'They'} moved to ${movingTo}`;
        if (following)
            return `Following ${presenter?.name ?? 'them'}`;
        if (paused && room.someoneElseIsPresenting) {
            return presenter?.name ? `You left ${presenter.name}’s view` : 'You left their view';
        }
        if (presenter)
            return `${presenter.name} is here`;
        return 'Have a look around';
    }, [movingTo, following, paused, presenter, room.someoneElseIsPresenting]);
    const sender = room.room?.members.find((m) => m.role === 'owner')?.name;
    if (!room.inRoom)
        return null;
    /**
     * The client's chrome is for people who are not editing.
     *
     * An owner or editor already has the studio, and telling a designer that
     * they sent themselves something to review is nonsense. It also keeps the
     * two surfaces from fighting over one stored identity on a machine where
     * both happen to mount.
     */
    if (room.role === 'owner' || room.role === 'editor')
        return null;
    /* ── Arrival: name yourself once. No account, ever. ── */
    if (room.needsName) {
        return (_jsx("div", { className: "froam-review", "data-chef-editor-root": "true", children: asking ? (_jsxs("div", { className: "froam-review__sheet", children: [_jsx("label", { className: "froam-review__label", htmlFor: "froam-review-name", children: "What should we call you?" }), _jsxs("div", { className: "froam-review__row", children: [_jsx("input", { id: "froam-review-name", className: "froam-review__input", value: name, autoFocus: true, placeholder: "Your name", onChange: (e) => setName(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter')
                                    void submit(); } }), _jsx("button", { type: "button", className: "froam-review__go", disabled: !name.trim() || room.joining, onClick: () => void submit(), children: room.joining ? '…' : 'Start' })] }), room.error && _jsx("p", { className: "froam-review__error", children: room.error })] })) : (_jsxs("div", { className: "froam-review__bar", children: [_jsxs("div", { className: "froam-review__who", children: [_jsx("b", { children: sender ? `${sender} sent this to review` : 'Sent to you for review' }), _jsx("span", { children: "Take a look \u2014 you can leave notes" })] }), _jsx("button", { type: "button", className: "froam-review__go", onClick: () => setAsking(true), children: "Start" })] })) }));
    }
    /* ── Writing a note ── */
    if (draft) {
        return (_jsx("div", { className: "froam-review", "data-chef-editor-root": "true", children: _jsxs("div", { className: "froam-review__sheet", children: [draft.quoted && _jsxs("p", { className: "froam-review__quote", children: ["\u201C", draft.quoted, "\u201D"] }), _jsx("textarea", { className: "froam-review__input froam-review__note", autoFocus: true, placeholder: "What would you change?", value: draft.body, onChange: (e) => setDraft({ ...draft, body: e.target.value }) }), _jsxs("div", { className: "froam-review__row", children: [_jsx("button", { type: "button", className: "froam-review__ghost", onClick: () => setDraft(null), children: "Cancel" }), _jsx("button", { type: "button", className: "froam-review__go", disabled: !draft.body.trim() || sending, onClick: () => void send(), children: sending ? '…' : 'Send' })] })] }) }));
    }
    /* ── In the session ── */
    return (_jsx("div", { className: "froam-review", "data-chef-editor-root": "true", children: commenting ? (_jsxs("div", { className: "froam-review__bar is-commenting", children: [_jsxs("div", { className: "froam-review__who", children: [_jsx("b", { children: "Tap anything you want changed" }), _jsx("span", { children: notes.length ? `${notes.length} note${notes.length === 1 ? '' : 's'} so far` : 'Your notes go straight to them' })] }), _jsx("button", { type: "button", className: "froam-review__go", onClick: () => setCommenting(false), children: "Done" })] })) : (_jsxs("div", { className: `froam-review__bar${movingTo ? ' is-moving' : ''}`, children: [_jsx("span", { className: `froam-review__dot${following ? ' is-live' : ''}`, "aria-hidden": "true" }), _jsxs("div", { className: "froam-review__who", children: [_jsx("b", { children: label }), _jsx("span", { children: following ? 'They are showing you the site' : `${room.present.length + 1} here` })] }), paused && room.someoneElseIsPresenting && !movingTo && (_jsx("button", { type: "button", className: "froam-review__ghost", onClick: () => setPaused(false), children: "Rejoin" })), canComment && (_jsx("button", { type: "button", className: "froam-review__go", onClick: () => setCommenting(true), children: notes.length ? `Notes · ${notes.length}` : 'Comment' }))] })) }));
}
//# sourceMappingURL=FroamReview.js.map