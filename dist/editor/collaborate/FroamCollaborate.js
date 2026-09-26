import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Camera, Check, Copy, Eye, EyeOff, Link2, MessageSquare, Pencil, RefreshCw, Send, Users, X } from 'lucide-react';
import { relativeTime } from '../chef/change-report.js';
import { shrinkAvatar } from './avatar-image.js';
import { PersonAvatar } from './PersonAvatar.js';
import { RoomMessages } from './RoomMessages.js';
const INVITES = [
    { role: 'contributor', title: 'Can suggest changes', body: 'For teammates who aren’t developers: they edit freely, then send it to you to approve.' },
    { role: 'editor', title: 'Can edit together', body: 'Designers and developers: edit the page with you, live.' },
    { role: 'commenter', title: 'Can comment', body: 'Clients: leave notes and approve designs.' },
    { role: 'viewer', title: 'Can view', body: 'See the page follow along, nothing more.' },
];
const ROLE_LABEL = {
    owner: 'Owner',
    editor: 'Editing',
    contributor: 'Suggesting',
    commenter: 'Commenting',
    viewer: 'Viewing',
};
const STATUS_LABEL = {
    pending: 'Waiting for approval',
    approved: 'Approved · live',
    'changes-requested': 'Changes requested',
    withdrawn: 'Withdrawn',
};
/** A new message peeks out under the button for this long when the panel is closed. */
const PEEK_MS = 6_000;
/** Typing in a field is words, not editor shortcuts — but Escape still closes the panel. */
function keepTyping(event) {
    if (event.key !== 'Escape')
        event.stopPropagation();
}
/** The name a fresh studio profile starts with; nobody is actually called that. */
const UNNAMED = 'Froam';
const ROLE_WELCOME = {
    contributor: 'You can edit anything on this page. Nothing goes live until the owner approves it.',
    editor: 'You can edit this page together with the owner, live.',
};
/**
 * Asked once, on arrival by link. This is your profile in the room: the owner
 * sees this face and name on every change you send and every message.
 */
function JoinPrompt({ role, known, onJoin }) {
    const [name, setName] = useState(known?.name ?? '');
    const [title, setTitle] = useState(known?.title ?? '');
    const [avatarUrl, setAvatarUrl] = useState(known?.avatarUrl ?? null);
    const [photoError, setPhotoError] = useState(null);
    const [joining, setJoining] = useState(false);
    const fileRef = useRef(null);
    const pickPhoto = async (file) => {
        if (!file)
            return;
        setPhotoError(null);
        try {
            setAvatarUrl(await shrinkAvatar(file));
        }
        catch (error) {
            setPhotoError(error instanceof Error ? error.message : 'That image could not be used');
        }
    };
    const join = async () => {
        if (!name.trim())
            return;
        setJoining(true);
        try {
            await onJoin(name.trim(), { avatarUrl, title: title.trim() });
        }
        finally {
            setJoining(false);
        }
    };
    const shown = name.trim() || 'Your name';
    return (_jsx("div", { className: "froam-collab__join-backdrop", "data-chef-editor-root": "true", children: _jsxs("form", { className: "froam-collab__join", role: "dialog", "aria-label": "Join", onSubmit: (event) => { event.preventDefault(); void join(); }, onKeyDown: (event) => event.stopPropagation(), children: [_jsx("strong", { children: "You\u2019ve been invited" }), _jsx("p", { children: (role && ROLE_WELCOME[role]) ?? 'Join to see this page with the people working on it.' }), _jsxs("div", { className: "froam-collab__join-profile", children: [_jsxs("button", { type: "button", className: "froam-collab__photo", onClick: () => fileRef.current?.click(), onDragOver: (event) => event.preventDefault(), onDrop: (event) => { event.preventDefault(); void pickPhoto(event.dataTransfer.files?.[0]); }, "aria-label": avatarUrl ? 'Change your photo' : 'Add a photo', children: [_jsx(PersonAvatar, { name: shown, avatarUrl: avatarUrl, size: 56 }), _jsx("span", { className: "froam-collab__photo-badge", children: _jsx(Camera, { size: 11 }) })] }), _jsx("input", { ref: fileRef, type: "file", accept: "image/*", hidden: true, onChange: (event) => { void pickPhoto(event.target.files?.[0]); event.target.value = ''; } }), _jsxs("div", { className: "froam-collab__join-fields", children: [_jsx("input", { className: "froam-collab__input", value: name, onChange: (event) => setName(event.target.value), placeholder: "Your name", "aria-label": "Your name", maxLength: 60, autoFocus: true }), _jsx("input", { className: "froam-collab__input", value: title, onChange: (event) => setTitle(event.target.value), placeholder: "What you do (optional) \u2014 e.g. Marketing", "aria-label": "What you do", maxLength: 40 })] })] }), photoError && _jsx("small", { className: "froam-collab__error", children: photoError }), _jsxs("div", { className: "froam-collab__join-preview", "aria-hidden": "true", children: [_jsx("small", { children: "How the owner will see you" }), _jsxs("div", { className: "froam-collab__who", children: [_jsx(PersonAvatar, { name: shown, avatarUrl: avatarUrl, size: 26 }), _jsxs("span", { children: [_jsx("strong", { children: shown }), _jsxs("small", { children: [title.trim() || ROLE_LABEL[role ?? 'contributor'], " \u00B7 just now"] })] })] })] }), _jsx("button", { type: "submit", className: "froam-collab__primary", disabled: !name.trim() || joining, children: joining ? 'Joining…' : 'Join' })] }) }));
}
function ChangeList({ changes }) {
    if (!changes.length)
        return _jsx("p", { className: "froam-collab__muted", children: "No changes yet \u2014 edit the page and they\u2019ll appear here." });
    return (_jsxs("ul", { className: "froam-collab__changes", children: [changes.slice(0, 12).map((change, index) => (_jsxs("li", { children: [_jsx("strong", { children: change.label }), (change.before || change.after) && (_jsxs("span", { children: [change.before && _jsx("del", { children: change.before }), change.before && change.after && _jsx("span", { "aria-hidden": "true", children: " \u2192 " }), change.after && _jsx("ins", { children: change.after })] }))] }, `${change.label}-${index}`))), changes.length > 12 && _jsxs("li", { className: "froam-collab__muted", children: ["and ", changes.length - 12, " more"] })] }));
}
/** Name, face and what they do — the head of every request and person row. */
function Who({ name, member, detail, onOpen }) {
    const body = (_jsxs(_Fragment, { children: [_jsx(PersonAvatar, { name: member?.name ?? name, color: member?.color, avatarUrl: member?.avatarUrl, size: 28, here: member ? member.here : undefined }), _jsxs("span", { children: [_jsx("strong", { children: member?.name ?? name }), _jsx("small", { children: [member?.title, detail].filter(Boolean).join(' · ') })] })] }));
    return onOpen
        ? _jsx("button", { type: "button", className: "froam-collab__who is-button", onClick: onOpen, children: body })
        : _jsx("div", { className: "froam-collab__who", children: body });
}
/** Everything the room knows about one person, and a way to talk to them. */
function ProfileSheet({ member, isMe, requests, onBack, onMessage, onEditProfile, onOpenRequest }) {
    const theirs = requests.filter((request) => request.actor === member.actor);
    const approved = theirs.filter((request) => request.status === 'approved').length;
    const where = member.here
        ? member.routeKey ? `Here now · on ${member.routeKey}` : 'Here now'
        : member.seenAt ? `Away · seen ${relativeTime(member.seenAt)}` : 'Away';
    return (_jsxs("div", { className: "froam-collab__profile", style: { '--froam-person': member.color }, children: [_jsxs("header", { className: "froam-collab__head", children: [_jsx("button", { type: "button", className: "froam-collab__icon", onClick: onBack, "aria-label": "Back", children: _jsx(ArrowLeft, { size: 14 }) }), _jsx("span", { className: "froam-collab__muted", children: isMe ? 'Your profile' : 'Profile' })] }), _jsxs("div", { className: "froam-collab__profile-hero", children: [_jsx(PersonAvatar, { name: member.name, color: member.color, avatarUrl: member.avatarUrl, size: 64, here: member.here, ring: true }), _jsx("strong", { children: isMe ? `${member.name} (you)` : member.name }), member.title && _jsx("span", { className: "froam-collab__profile-title", children: member.title }), _jsx("span", { className: "froam-collab__chip", children: ROLE_LABEL[member.role] })] }), _jsxs("dl", { className: "froam-collab__facts", children: [_jsxs("div", { children: [_jsx("dt", { children: "Status" }), _jsx("dd", { children: where })] }), member.joinedAt && _jsxs("div", { children: [_jsx("dt", { children: "Joined" }), _jsx("dd", { children: relativeTime(member.joinedAt) })] }), (theirs.length > 0 || member.role === 'contributor') && (_jsxs("div", { children: [_jsx("dt", { children: "Changes sent" }), _jsxs("dd", { children: [theirs.length, theirs.length ? ` · ${approved} approved` : ''] })] }))] }), theirs.length > 0 && (_jsx("ul", { className: "froam-collab__their-requests", children: theirs.slice(0, 5).map((request) => (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => onOpenRequest?.(request), disabled: !onOpenRequest, children: [_jsx("span", { children: request.title }), _jsx("small", { className: `is-${request.status}`, children: STATUS_LABEL[request.status] })] }) }, request.id))) })), _jsx("div", { className: "froam-collab__actions", children: isMe
                    ? _jsxs("button", { type: "button", className: "froam-collab__primary", onClick: onEditProfile, children: [_jsx(Pencil, { size: 12 }), " Edit your profile"] })
                    : _jsxs("button", { type: "button", className: "froam-collab__primary", onClick: onMessage, children: [_jsx(MessageSquare, { size: 13 }), " Message ", member.name.split(/\s+/)[0]] }) })] }));
}
/**
 * Share, talk, and publishing without a developer — everything about working
 * with other people, in one control in the toolbar.
 *
 * The owner invites people by what they may do; everyone in the room talks in
 * Chat; a contributor edits privately and submits; the owner previews a
 * request on the page, then approves (which publishes it) or sends it back.
 * Every request and message carries the sender's profile.
 */
export function FroamCollaborate(props) {
    const { role, isOwner, inRoom, people, requests, messaging } = props;
    const isContributor = role === 'contributor';
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState(isContributor ? 'changes' : 'share');
    const [title, setTitle] = useState('');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [copiedRole, setCopiedRole] = useState(null);
    const [replyFor, setReplyFor] = useState(null);
    const [reply, setReply] = useState('');
    const [deciding, setDeciding] = useState(null);
    const [viewing, setViewing] = useState(null);
    const [chatAbout, setChatAbout] = useState(null);
    const [prefill, setPrefill] = useState(null);
    const [focusRequest, setFocusRequest] = useState(null);
    const [peek, setPeek] = useState(null);
    const rootRef = useRef(null);
    const panelRef = useRef(null);
    const openedAtRef = useRef(Date.now());
    const [place, setPlace] = useState({});
    const pending = requests.filter((request) => request.status === 'pending');
    const here = people.filter((person) => person.here);
    const everyone = useMemo(() => {
        const map = new Map();
        for (const person of people)
            map.set(person.actor, person);
        if (props.me)
            map.set(props.me.actor, props.me);
        return map;
    }, [people, props.me]);
    const person = (actor) => everyone.get(actor);
    // A role arrives after the first render (joining takes a moment).
    useEffect(() => { if (isContributor)
        setTab((current) => (current === 'share' ? 'changes' : current)); }, [isContributor]);
    useEffect(() => {
        if (!open)
            return;
        const onKey = (event) => { if (event.key === 'Escape')
            setOpen(false); };
        const onDown = (event) => {
            const target = event.target;
            if (rootRef.current?.contains(target) || panelRef.current?.contains(target))
                return;
            setOpen(false);
        };
        window.addEventListener('keydown', onKey);
        window.addEventListener('pointerdown', onDown, true);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('pointerdown', onDown, true);
        };
    }, [open]);
    // The panel is drawn above everything (the floating bar included), under its button.
    useLayoutEffect(() => {
        if (!open && !peek)
            return;
        const measure = () => {
            const rect = rootRef.current?.getBoundingClientRect();
            if (rect)
                setPlace({ top: Math.round(rect.bottom + 8), right: Math.max(8, Math.round(window.innerWidth - rect.right)) });
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [open, peek]);
    // A new request is what the owner opens this for.
    useEffect(() => { if (isOwner && pending.length)
        setTab('requests'); }, [isOwner, pending.length]);
    const toggle = () => {
        if (open) {
            setOpen(false);
            return;
        }
        setViewing(null);
        if (messaging.unread > 0 && props.joined)
            setTab('chat');
        else if (isOwner && pending.length)
            setTab('requests');
        else if (isContributor)
            setTab('changes');
        else if (tab === 'chat' && !props.joined)
            setTab('share');
        setOpen(true);
    };
    // Someone wrote while you weren't looking at the chat: show it for a moment.
    const incoming = messaging.latestIncoming;
    useEffect(() => {
        if (!incoming || incoming.createdAt < openedAtRef.current)
            return;
        if (open && tab === 'chat')
            return;
        setPeek(incoming.id);
        const timer = window.setTimeout(() => setPeek((current) => (current === incoming.id ? null : current)), PEEK_MS);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [incoming?.id]);
    useEffect(() => { if (open && tab === 'chat')
        setPeek(null); }, [open, tab]);
    // Scroll a request into view when something (the chat, a profile) points at it.
    useEffect(() => {
        if (!focusRequest || (tab !== 'requests' && tab !== 'changes'))
            return;
        const node = panelRef.current?.querySelector(`[data-request-id="${CSS.escape(focusRequest)}"]`);
        node?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        const timer = window.setTimeout(() => setFocusRequest(null), 1600);
        return () => window.clearTimeout(timer);
    }, [focusRequest, tab]);
    const copy = (link, inviteRole) => {
        props.onCopyLink(link, inviteRole);
        setCopiedRole(inviteRole);
        window.setTimeout(() => setCopiedRole((current) => (current === inviteRole ? null : current)), 1800);
    };
    const submit = async () => {
        setSubmitting(true);
        const ok = await props.onSubmit(title.trim(), note.trim());
        setSubmitting(false);
        if (ok) {
            setTitle('');
            setNote('');
        }
    };
    const decide = async (request, decision) => {
        setDeciding(request.id);
        try {
            await props.onDecide(request, decision, decision === 'changes-requested' ? reply.trim() : '');
            setReplyFor(null);
            setReply('');
        }
        finally {
            setDeciding(null);
        }
    };
    const openRequest = (request) => {
        setViewing(null);
        setTab(isOwner ? 'requests' : 'changes');
        setFocusRequest(request.id);
    };
    const canOpenRequests = isOwner || isContributor;
    const discuss = (request) => {
        setChatAbout(request);
        setTab('chat');
    };
    const messagePerson = (member) => {
        setViewing(null);
        setTab('chat');
        setPrefill({ text: `@${member.name.split(/\s+/)[0]} `, nonce: Date.now() });
    };
    const openChatFromPeek = () => {
        setPeek(null);
        setOpen(true);
        setTab('chat');
    };
    const needsFreshLinks = inRoom && isOwner && !props.links.contributor;
    const badge = isOwner ? pending.length : isContributor ? props.pendingChanges.length : 0;
    const viewingMember = viewing ? person(viewing) : null;
    const peekMessage = peek ? messaging.messages.find((message) => message.id === peek) : null;
    const peekAuthor = peekMessage ? person(peekMessage.actor) : null;
    const portal = typeof document !== 'undefined' ? document.getElementById('froam-editor-portal') ?? document.body : null;
    const tabs = isContributor
        ? [{ id: 'changes', label: 'Your changes', count: props.pendingChanges.length }, { id: 'chat', label: 'Chat', count: messaging.unread, tone: 'chat' }]
        : [
            { id: 'share', label: 'Share' },
            ...(props.joined ? [{ id: 'chat', label: 'Chat', count: messaging.unread, tone: 'chat' }] : []),
            ...(isOwner ? [{ id: 'requests', label: 'Requests', count: pending.length }] : []),
        ];
    const requestCard = (request, mode) => {
        const previewing = props.previewingId === request.id;
        const sender = person(request.actor);
        return (_jsxs("article", { "data-request-id": request.id, className: `froam-collab__request is-${request.status}${focusRequest === request.id ? ' is-focused' : ''}`, children: [mode === 'owner' && (_jsx(Who, { name: request.createdBy, member: sender, detail: `${relativeTime(request.createdAt)} · ${request.routeKey}`, onOpen: sender ? () => setViewing(sender.actor) : undefined })), _jsxs("div", { className: "froam-collab__request-head", children: [_jsx("strong", { children: request.title }), _jsx("span", { className: "froam-collab__status", children: STATUS_LABEL[request.status] })] }), mode === 'sender' && (_jsxs("small", { children: [relativeTime(request.decidedAt ?? request.createdAt), request.decidedBy ? ` · ${request.decidedBy}` : ''] })), request.note && mode === 'owner' && _jsxs("blockquote", { children: ["\u201C", request.note, "\u201D"] }), mode === 'owner' && _jsx(ChangeList, { changes: request.changes }), request.published?.detail && request.status === 'approved' && mode === 'owner' && _jsx("p", { className: "froam-collab__muted", children: request.published.detail }), request.decisionNote && request.status !== 'pending' && (_jsxs("blockquote", { children: [mode === 'owner' ? 'You' : request.decidedBy ?? 'Owner', ": \u201C", request.decisionNote, "\u201D"] })), mode === 'owner' && request.status === 'pending' && (replyFor === request.id ? (_jsxs("div", { className: "froam-collab__reply", children: [_jsx("textarea", { className: "froam-collab__input", value: reply, onChange: (event) => setReply(event.target.value), onKeyDown: keepTyping, placeholder: "What should change?", "aria-label": "What should change", rows: 2, autoFocus: true }), _jsxs("div", { className: "froam-collab__actions", children: [_jsx("button", { type: "button", className: "froam-collab__ghost", onClick: () => { setReplyFor(null); setReply(''); }, children: "Cancel" }), _jsx("button", { type: "button", className: "froam-collab__secondary", disabled: deciding === request.id, onClick: () => void decide(request, 'changes-requested'), children: "Send back" })] })] })) : (_jsxs("div", { className: "froam-collab__actions", children: [_jsx("button", { type: "button", className: "froam-collab__ghost", onClick: () => props.onPreview(previewing ? null : request), "aria-pressed": previewing, children: previewing ? _jsxs(_Fragment, { children: [_jsx(EyeOff, { size: 12 }), " Stop preview"] }) : _jsxs(_Fragment, { children: [_jsx(Eye, { size: 12 }), " Preview"] }) }), props.joined && _jsxs("button", { type: "button", className: "froam-collab__ghost", onClick: () => discuss(request), children: [_jsx(MessageSquare, { size: 12 }), " Discuss"] }), _jsx("button", { type: "button", className: "froam-collab__secondary", onClick: () => setReplyFor(request.id), children: "Request changes" }), _jsxs("button", { type: "button", className: "froam-collab__primary", disabled: deciding === request.id, onClick: () => void decide(request, 'approved'), children: [_jsx(Check, { size: 13 }), " ", deciding === request.id ? 'Publishing…' : 'Approve & publish'] })] }))), mode === 'owner' && request.status !== 'pending' && props.joined && (_jsx("div", { className: "froam-collab__actions", children: _jsxs("button", { type: "button", className: "froam-collab__ghost", onClick: () => discuss(request), children: [_jsx(MessageSquare, { size: 12 }), " Discuss"] }) })), mode === 'sender' && (_jsxs("div", { className: "froam-collab__actions", children: [props.joined && _jsxs("button", { type: "button", className: "froam-collab__ghost", onClick: () => discuss(request), children: [_jsx(MessageSquare, { size: 12 }), " Discuss"] }), request.status === 'pending' && _jsx("button", { type: "button", className: "froam-collab__ghost", onClick: () => props.onWithdraw(request), children: "Withdraw" })] }))] }, request.id));
    };
    return (_jsxs("div", { className: "froam-collab", ref: rootRef, "data-chef-editor-root": "true", children: [props.needsName && portal && createPortal(_jsx(JoinPrompt, { role: role, known: props.knownProfile, onJoin: props.onJoin }), portal), _jsxs("button", { type: "button", className: `froam-collab__trigger${open ? ' is-open' : ''}`, onClick: toggle, "aria-expanded": open, "aria-haspopup": "dialog", title: isContributor ? 'Your suggested changes and chat' : 'Share, chat and review', "data-chef-editor-root": "true", children: [here.length > 0 && (_jsxs("span", { className: "froam-collab__faces", children: [here.slice(0, 3).map((member) => _jsx(PersonAvatar, { name: member.name, color: member.color, avatarUrl: member.avatarUrl, size: 18, ring: true }, member.actor)), here.length > 3 && _jsxs("span", { className: "froam-collab__more", children: ["+", here.length - 3] })] })), isContributor ? _jsx(Send, { size: 13 }) : _jsx(Users, { size: 13 }), _jsx("span", { children: isContributor ? 'Submit' : 'Share' }), badge > 0 && (_jsx("span", { className: "froam-collab__badge", "aria-label": isOwner ? `${pending.length} waiting for approval` : `${props.pendingChanges.length} changes`, children: badge })), messaging.unread > 0 && (_jsxs("span", { className: "froam-collab__badge is-chat", "aria-label": `${messaging.unread} unread messages`, children: [_jsx(MessageSquare, { size: 9 }), messaging.unread] }))] }), !open && peekMessage && portal && createPortal(_jsxs("button", { type: "button", className: "froam-collab__peek", style: place, onClick: openChatFromPeek, "data-chef-editor-root": "true", children: [_jsx(PersonAvatar, { name: peekAuthor?.name ?? peekMessage.name, color: peekAuthor?.color, avatarUrl: peekAuthor?.avatarUrl, size: 28 }), _jsxs("span", { children: [_jsx("strong", { children: peekAuthor?.name ?? peekMessage.name }), _jsx("span", { children: peekMessage.body })] }), _jsx("span", { className: "froam-collab__peek-reply", children: "Reply" })] }), portal), open && portal && createPortal(_jsx("div", { className: "froam-collab__panel", ref: panelRef, style: place, role: "dialog", "aria-label": isContributor ? 'Your changes and chat' : 'Share, chat and review', "data-chef-editor-root": "true", children: viewingMember ? (_jsx(ProfileSheet, { member: viewingMember, isMe: viewingMember.actor === props.me?.actor, requests: requests, onBack: () => setViewing(null), onMessage: () => messagePerson(viewingMember), onEditProfile: () => { setOpen(false); props.onEditProfile(); }, onOpenRequest: canOpenRequests ? openRequest : undefined })) : (_jsxs(_Fragment, { children: [_jsxs("header", { className: "froam-collab__head", children: [_jsx("div", { className: "froam-collab__tabs", role: "tablist", children: tabs.map((item) => (_jsxs("button", { type: "button", role: "tab", "aria-selected": tab === item.id, className: tab === item.id ? 'is-active' : '', onClick: () => setTab(item.id), children: [item.label, item.count ? _jsx("span", { className: `froam-collab__badge${item.tone === 'chat' ? ' is-chat' : ''}`, children: item.count }) : null] }, item.id))) }), _jsx("button", { type: "button", className: "froam-collab__icon", onClick: () => setOpen(false), "aria-label": "Close", children: _jsx(X, { size: 14 }) })] }), tab === 'changes' && isContributor && (_jsxs(_Fragment, { children: [_jsx("p", { className: "froam-collab__intro", children: "Edit anything on the page. Nothing goes live until the owner approves it." }), _jsxs("section", { className: "froam-collab__section", children: [_jsxs("h4", { children: ["Your changes ", _jsx("small", { children: props.pendingChanges.length })] }), _jsx(ChangeList, { changes: props.pendingChanges }), _jsx("input", { className: "froam-collab__input", value: title, onChange: (event) => setTitle(event.target.value), onKeyDown: keepTyping, placeholder: "What is this? e.g. Spring sale copy", "aria-label": "Title for your changes", maxLength: 120 }), _jsx("textarea", { className: "froam-collab__input", value: note, onChange: (event) => setNote(event.target.value), onKeyDown: keepTyping, placeholder: "Anything the owner should know (optional)", "aria-label": "Note for the owner", rows: 2 }), _jsxs("button", { type: "button", className: "froam-collab__primary", disabled: !props.pendingChanges.length || submitting, onClick: () => void submit(), children: [_jsx(Send, { size: 13 }), " ", submitting ? 'Sending…' : 'Submit for approval'] })] }), requests.length > 0 && (_jsxs("section", { className: "froam-collab__section", children: [_jsx("h4", { children: "Sent" }), requests.map((request) => requestCard(request, 'sender'))] })), props.me && (_jsx("section", { className: "froam-collab__section", children: _jsx(Who, { name: props.myName, member: props.me, detail: "This is how the owner sees you", onOpen: () => setViewing(props.me.actor) }) }))] })), tab === 'chat' && (_jsx(RoomMessages, { messaging: messaging, me: props.me?.actor ?? null, myName: props.me?.name ?? props.myName, person: person, requests: requests, active: open && tab === 'chat', context: chatAbout, onClearContext: () => setChatAbout(null), onOpenRequest: canOpenRequests ? openRequest : undefined, onOpenPerson: (actor) => { if (person(actor))
                                setViewing(actor); }, prefill: prefill, canModerate: isOwner || role === 'editor', joined: props.joined })), tab === 'share' && !isContributor && (!inRoom ? (_jsxs("section", { className: "froam-collab__section froam-collab__empty", children: [_jsx(Link2, { size: 22 }), _jsx("strong", { children: "Bring people in" }), _jsx("p", { children: "Anyone with a link can join \u2014 no account needed. You choose what each link can do, and everyone can talk here in Chat." }), props.shareUnavailable ? (_jsxs("div", { className: "froam-collab__unavailable", role: "status", children: [_jsx("strong", { children: "Sharing needs Froam running with your site" }), _jsx("p", { children: "Invite links are served by Froam itself, and this page isn\u2019t connected to it. In your project, run:" }), _jsx("code", { children: "npx @ahmadastic/froam" }), _jsxs("p", { children: ["Then open Share there \u2014 add ", _jsx("code", { children: "--host" }), " so people on your network can join."] })] })) : (_jsx("button", { type: "button", className: "froam-collab__primary", disabled: props.opening, onClick: () => props.onOpenRoom(false), children: props.opening ? 'Opening…' : 'Create invite links' }))] })) : (_jsxs(_Fragment, { children: [isOwner && (props.me?.name ?? props.myName) === UNNAMED && (_jsxs("p", { className: "froam-collab__notice is-profile", children: ["People see you as \u201C", UNNAMED, "\u201D.", ' ', _jsx("button", { type: "button", className: "froam-collab__link", onClick: () => { setOpen(false); props.onEditProfile(); }, children: "Add your name and photo" })] })), needsFreshLinks && (_jsxs("p", { className: "froam-collab__notice", children: ["This room predates \u201CCan suggest changes\u201D.", ' ', _jsx("button", { type: "button", className: "froam-collab__link", onClick: () => props.onOpenRoom(true), children: "Create new links" })] })), isOwner && (_jsxs("section", { className: "froam-collab__section", children: [INVITES.map((invite) => {
                                            const link = props.links[invite.role];
                                            return (_jsxs("div", { className: "froam-collab__invite", children: [_jsxs("div", { children: [_jsx("strong", { children: invite.title }), _jsx("p", { children: invite.body })] }), _jsx("button", { type: "button", className: "froam-collab__copy", disabled: !link, onClick: () => link && copy(link, invite.role), "aria-label": `Copy the “${invite.title}” link`, children: copiedRole === invite.role ? _jsxs(_Fragment, { children: [_jsx(Check, { size: 12 }), " Copied"] }) : _jsxs(_Fragment, { children: [_jsx(Copy, { size: 12 }), " Copy link"] }) })] }, invite.role));
                                        }), _jsxs("button", { type: "button", className: "froam-collab__ghost", onClick: () => props.onOpenRoom(true), children: [_jsx(RefreshCw, { size: 12 }), " Reset links (old ones stop working)"] })] })), _jsxs("section", { className: "froam-collab__section", children: [_jsxs("h4", { children: ["People ", _jsxs("small", { children: [here.length + (props.me ? 1 : 0), " here"] })] }), _jsxs("ul", { className: "froam-collab__people", children: [props.me && (_jsxs("li", { children: [_jsx(Who, { name: props.myName, member: props.me, detail: `${ROLE_LABEL[props.me.role]} · you`, onOpen: () => setViewing(props.me.actor) }), _jsxs("button", { type: "button", className: "froam-collab__ghost", onClick: () => { setOpen(false); props.onEditProfile(); }, children: [_jsx(Pencil, { size: 11 }), " Profile"] })] })), people.map((member) => (_jsxs("li", { children: [_jsx(Who, { name: member.name, member: member, detail: `${ROLE_LABEL[member.role]}${member.here ? (member.routeKey ? ` · on ${member.routeKey}` : ' · here') : ' · away'}`, onOpen: () => setViewing(member.actor) }), props.joined && (_jsx("button", { type: "button", className: "froam-collab__icon", onClick: () => messagePerson(member), "aria-label": `Message ${member.name}`, children: _jsx(MessageSquare, { size: 13 }) }))] }, member.actor)))] }), people.length === 0 && _jsx("p", { className: "froam-collab__muted", children: "Nobody else has joined yet. Copy a link above and send it to someone." })] })] }))), tab === 'requests' && isOwner && (_jsxs("section", { className: "froam-collab__section", children: [requests.length === 0 && _jsx("p", { className: "froam-collab__muted", children: "No requests yet. Send a \u201CCan suggest changes\u201D link to someone who isn\u2019t a developer \u2014 what they submit lands here, with their name and photo." }), requests.map((request) => requestCard(request, 'owner'))] }))] })) }), portal)] }));
}
//# sourceMappingURL=FroamCollaborate.js.map