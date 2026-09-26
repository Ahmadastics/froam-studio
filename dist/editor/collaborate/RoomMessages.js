import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, CornerDownLeft, FileDiff, RotateCcw, Send, X } from 'lucide-react';
import { PersonAvatar } from './PersonAvatar.js';
/** Messages from one person closer together than this read as one thought. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;
const clock = (ts) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
function dayLabel(ts) {
    const day = new Date(ts);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86_400_000);
    if (day.toDateString() === today.toDateString())
        return 'Today';
    if (day.toDateString() === yesterday.toDateString())
        return 'Yesterday';
    return day.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}
/** Links stay links; everything else is text (never HTML). */
function Linkified({ text }) {
    const parts = text.split(/(https?:\/\/[^\s<>"']+)/g);
    return (_jsx(_Fragment, { children: parts.map((part, index) => /^https?:\/\//.test(part)
            ? _jsx("a", { href: part, target: "_blank", rel: "noopener noreferrer", children: part }, index)
            : _jsx(Fragment, { children: part }, index)) }));
}
/** What happened to requests, told in the same timeline as the talk about them. */
function requestActivity(requests, me, myName) {
    const items = [];
    for (const request of requests) {
        const sender = request.actor === me ? 'You' : request.createdBy;
        items.push({
            kind: 'activity',
            id: `${request.id}:sent`,
            at: request.createdAt,
            actor: request.actor,
            request,
            text: _jsxs(_Fragment, { children: [sender, " sent ", _jsx("b", { children: request.title }), " for approval"] }),
        });
        if (request.decidedAt && request.status !== 'pending') {
            const who = request.decidedBy && request.decidedBy === myName ? 'You' : request.decidedBy ?? 'The owner';
            const verb = request.status === 'approved'
                ? 'approved and published'
                : request.status === 'withdrawn'
                    ? 'withdrew'
                    : 'asked for changes to';
            items.push({
                kind: 'activity',
                id: `${request.id}:${request.status}`,
                at: request.decidedAt,
                actor: null,
                request,
                text: _jsxs(_Fragment, { children: [request.status === 'withdrawn' ? sender : who, " ", verb, " ", _jsx("b", { children: request.title })] }),
            });
        }
    }
    return items;
}
/**
 * The room's conversation: messages, and what happened to every request, in
 * one place — so "can you make it shorter?" sits right under the change it
 * is about.
 */
export function RoomMessages({ messaging, me, myName, person, requests, active, context, onClearContext, onOpenRequest, onOpenPerson, prefill, canModerate, joined, }) {
    const [draft, setDraft] = useState('');
    const [atBottom, setAtBottom] = useState(true);
    const listRef = useRef(null);
    const inputRef = useRef(null);
    const lastCountRef = useRef(0);
    const requestsById = useMemo(() => new Map(requests.map((request) => [request.id, request])), [requests]);
    const entries = useMemo(() => {
        const list = [
            ...messaging.messages.map((message) => ({ kind: 'message', id: message.id, at: message.createdAt, message })),
            ...requestActivity(requests, me, myName ?? null),
        ];
        return list.sort((a, b) => a.at - b.at);
    }, [messaging.messages, requests, me, myName]);
    useEffect(() => { if (active && atBottom)
        messaging.markRead(); }, [active, atBottom, messaging]);
    useEffect(() => {
        if (!prefill)
            return;
        setDraft((current) => (current.includes(prefill.text) ? current : `${prefill.text}${current}`));
        window.setTimeout(() => inputRef.current?.focus(), 0);
    }, [prefill]);
    useEffect(() => { if (context)
        window.setTimeout(() => inputRef.current?.focus(), 0); }, [context]);
    // Follow the conversation while you're at the end of it; if you've scrolled
    // up to read, stay put and offer a way down instead of yanking you.
    useLayoutEffect(() => {
        const list = listRef.current;
        if (!list)
            return;
        const grew = entries.length > lastCountRef.current;
        const mineLast = entries[entries.length - 1]?.kind === 'message'
            && entries[entries.length - 1].message.actor === me;
        lastCountRef.current = entries.length;
        if (grew && (atBottom || mineLast))
            list.scrollTop = list.scrollHeight;
    }, [entries, atBottom, me]);
    useLayoutEffect(() => {
        const list = listRef.current;
        if (active && list)
            list.scrollTop = list.scrollHeight;
    }, [active]);
    // Grow with what you type, up to a few lines.
    useLayoutEffect(() => {
        const input = inputRef.current;
        if (!input)
            return;
        input.style.height = 'auto';
        input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
    }, [draft]);
    const onScroll = () => {
        const list = listRef.current;
        if (!list)
            return;
        setAtBottom(list.scrollHeight - list.scrollTop - list.clientHeight < 24);
    };
    const send = async () => {
        const body = draft.trim();
        if (!body)
            return;
        setDraft('');
        onClearContext();
        await messaging.send(body, context?.id ?? null);
    };
    const pendingProposals = canModerate ? messaging.proposals.filter((proposal) => proposal.status === 'pending') : [];
    let lastDay = '';
    let previous = null;
    return (_jsxs("div", { className: "froam-chat", "data-chef-editor-root": "true", children: [pendingProposals.length > 0 && (_jsx("div", { className: "froam-chat__proposals", children: pendingProposals.map((proposal) => (_jsxs("div", { className: "froam-chat__proposal", children: [_jsx(RotateCcw, { size: 13 }), _jsxs("span", { children: [_jsx("b", { children: proposal.name }), " wants to undo someone else\u2019s change"] }), _jsx("button", { type: "button", className: "froam-collab__ghost", onClick: () => void messaging.decideProposal(proposal.id, 'declined'), children: "Keep" }), _jsx("button", { type: "button", className: "froam-collab__secondary", onClick: () => void messaging.decideProposal(proposal.id, 'approved'), children: "Allow" })] }, proposal.id))) })), _jsxs("div", { className: "froam-chat__list", ref: listRef, onScroll: onScroll, "aria-live": "polite", "aria-label": "Messages", children: [entries.length === 0 && (_jsxs("div", { className: "froam-chat__empty", children: [_jsx("strong", { children: "Start the conversation" }), _jsx("p", { children: "Everyone in this room sees what you write here \u2014 questions, feedback, \u201Clooks great\u201D." })] })), entries.map((entry) => {
                        const day = dayLabel(entry.at);
                        const divider = day !== lastDay ? _jsx("div", { className: "froam-chat__day", children: _jsx("span", { children: day }) }, `day-${entry.id}`) : null;
                        lastDay = day;
                        if (entry.kind === 'activity') {
                            previous = entry;
                            return (_jsxs(Fragment, { children: [divider, _jsxs("div", { className: "froam-chat__activity", children: [_jsx(FileDiff, { size: 12 }), _jsx("span", { children: entry.text }), onOpenRequest && _jsx("button", { type: "button", className: "froam-collab__link", onClick: () => onOpenRequest(entry.request), children: "View" })] })] }, entry.id));
                        }
                        const { message } = entry;
                        const mine = message.actor === me;
                        const author = person(message.actor);
                        const name = mine ? 'You' : author?.name ?? message.name;
                        const prev = previous;
                        const grouped = !divider
                            && prev?.kind === 'message'
                            && prev.message.actor === message.actor
                            && message.createdAt - prev.message.createdAt < GROUP_WINDOW_MS
                            && !message.requestId;
                        previous = entry;
                        const about = message.requestId ? requestsById.get(message.requestId) : null;
                        return (_jsxs(Fragment, { children: [divider, _jsxs("div", { className: `froam-chat__msg${mine ? ' is-mine' : ''}${grouped ? ' is-grouped' : ''}${message.state ? ` is-${message.state}` : ''}`, children: [!mine && (grouped ? _jsx("span", { className: "froam-chat__gutter" }) : (_jsx("button", { type: "button", className: "froam-chat__face", onClick: () => onOpenPerson?.(message.actor), "aria-label": `About ${name}`, children: _jsx(PersonAvatar, { name: author?.name ?? message.name, color: author?.color, avatarUrl: author?.avatarUrl, size: 26 }) }))), _jsxs("div", { className: "froam-chat__stack", children: [!grouped && (_jsxs("div", { className: "froam-chat__meta", children: [!mine && (_jsx("button", { type: "button", className: "froam-chat__name", onClick: () => onOpenPerson?.(message.actor), style: { color: author?.color ?? undefined }, children: name })), !mine && author?.title && _jsx("span", { className: "froam-chat__title", children: author.title }), _jsx("time", { dateTime: new Date(message.createdAt).toISOString(), children: clock(message.createdAt) })] })), about && (_jsxs("button", { type: "button", className: "froam-chat__about", onClick: () => onOpenRequest?.(about), children: [_jsx(CornerDownLeft, { size: 11 }), " ", about.title] })), _jsx("div", { className: "froam-chat__bubble", children: _jsx(Linkified, { text: message.body }) }), message.state === 'sending' && _jsx("small", { className: "froam-chat__state", children: "Sending\u2026" }), message.state === 'failed' && (_jsxs("small", { className: "froam-chat__state is-failed", children: ["Not sent. ", _jsx("button", { type: "button", className: "froam-collab__link", onClick: () => void messaging.retry(message), children: "Try again" })] }))] })] })] }, entry.id));
                    })] }), !atBottom && (_jsxs("button", { type: "button", className: "froam-chat__jump", onClick: () => { const list = listRef.current; if (list)
                    list.scrollTop = list.scrollHeight; }, children: [_jsx(ArrowDown, { size: 12 }), " ", messaging.unread ? `${messaging.unread} new` : 'Latest'] })), _jsxs("form", { className: "froam-chat__composer", onSubmit: (event) => { event.preventDefault(); void send(); }, children: [context && (_jsxs("div", { className: "froam-chat__context", children: [_jsx(CornerDownLeft, { size: 11 }), _jsxs("span", { children: ["About ", _jsx("b", { children: context.title })] }), _jsx("button", { type: "button", className: "froam-collab__icon", onClick: onClearContext, "aria-label": "Not about this request", children: _jsx(X, { size: 11 }) })] })), _jsxs("div", { className: "froam-chat__field", children: [_jsx("textarea", { ref: inputRef, className: "froam-collab__input", value: draft, rows: 1, maxLength: 2_000, disabled: !joined, placeholder: joined ? (context ? 'Say what should change…' : 'Message everyone in the room') : 'Join the room to send messages', "aria-label": "Message the room", onChange: (event) => setDraft(event.target.value), onKeyDown: (event) => {
                                    // Keys typed here are words, never editor shortcuts.
                                    if (event.key !== 'Escape')
                                        event.stopPropagation();
                                    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                                        event.preventDefault();
                                        void send();
                                    }
                                } }), _jsx("button", { type: "submit", className: "froam-chat__send", disabled: !joined || !draft.trim(), "aria-label": "Send", children: _jsx(Send, { size: 14 }) })] }), _jsx("small", { className: "froam-chat__hint", children: "Enter to send \u00B7 Shift+Enter for a new line" })] })] }));
}
//# sourceMappingURL=RoomMessages.js.map