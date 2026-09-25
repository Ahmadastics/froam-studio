import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Eye, EyeOff, Link2, RefreshCw, Send, Users, X } from 'lucide-react';
import { relativeTime } from '../chef/change-report.js';
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
const ROLE_WELCOME = {
    contributor: 'You can edit anything on this page. Nothing goes live until the owner approves it.',
    editor: 'You can edit this page together with the owner, live.',
};
/** Asked once, on arrival by link: the name is what the owner sees on your changes. */
function JoinPrompt({ role, onJoin }) {
    const [name, setName] = useState('');
    const [joining, setJoining] = useState(false);
    const join = async () => {
        if (!name.trim())
            return;
        setJoining(true);
        try {
            await onJoin(name.trim());
        }
        finally {
            setJoining(false);
        }
    };
    return (_jsx("div", { className: "froam-collab__join-backdrop", "data-chef-editor-root": "true", children: _jsxs("form", { className: "froam-collab__join", role: "dialog", "aria-label": "Join", onSubmit: (event) => { event.preventDefault(); void join(); }, children: [_jsx("strong", { children: "You\u2019ve been invited" }), _jsx("p", { children: (role && ROLE_WELCOME[role]) ?? 'Join to see this page with the people working on it.' }), _jsx("input", { className: "froam-collab__input", value: name, onChange: (event) => setName(event.target.value), placeholder: "Your name", "aria-label": "Your name", maxLength: 60, autoFocus: true }), _jsx("button", { type: "submit", className: "froam-collab__primary", disabled: !name.trim() || joining, children: joining ? 'Joining…' : 'Join' })] }) }));
}
function Avatar({ name, color, here = true }) {
    const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?';
    return (_jsx("span", { className: `froam-collab__avatar${here ? '' : ' is-away'}`, style: { background: color ?? '#64748b' }, title: name, "aria-hidden": "true", children: initials }));
}
function ChangeList({ changes }) {
    if (!changes.length)
        return _jsx("p", { className: "froam-collab__muted", children: "No changes yet \u2014 edit the page and they\u2019ll appear here." });
    return (_jsxs("ul", { className: "froam-collab__changes", children: [changes.slice(0, 12).map((change, index) => (_jsxs("li", { children: [_jsx("strong", { children: change.label }), (change.before || change.after) && (_jsxs("span", { children: [change.before && _jsx("del", { children: change.before }), change.before && change.after && _jsx("span", { "aria-hidden": "true", children: " \u2192 " }), change.after && _jsx("ins", { children: change.after })] }))] }, `${change.label}-${index}`))), changes.length > 12 && _jsxs("li", { className: "froam-collab__muted", children: ["and ", changes.length - 12, " more"] })] }));
}
/**
 * Share, together, and publishing without a developer.
 *
 * One control in the toolbar: who is here, and what they're waiting on. The
 * owner invites people by what they may do; a contributor edits privately and
 * submits; the owner previews a request on the page, then approves (which
 * publishes it) or sends it back with a note.
 */
export function FroamCollaborate(props) {
    const { role, isOwner, inRoom, people, requests } = props;
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState('share');
    const [title, setTitle] = useState('');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [copiedRole, setCopiedRole] = useState(null);
    const [replyFor, setReplyFor] = useState(null);
    const [reply, setReply] = useState('');
    const [deciding, setDeciding] = useState(null);
    const rootRef = useRef(null);
    const panelRef = useRef(null);
    const [place, setPlace] = useState({});
    const isContributor = role === 'contributor';
    const pending = requests.filter((request) => request.status === 'pending');
    const here = people.filter((person) => person.here);
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
        if (!open)
            return;
        const measure = () => {
            const rect = rootRef.current?.getBoundingClientRect();
            if (rect)
                setPlace({ top: Math.round(rect.bottom + 8), right: Math.max(8, Math.round(window.innerWidth - rect.right)) });
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [open]);
    // A new request is what the owner opens this for.
    useEffect(() => { if (isOwner && pending.length)
        setTab('requests'); }, [isOwner, pending.length]);
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
    const needsFreshLinks = inRoom && isOwner && !props.links.contributor;
    return (_jsxs("div", { className: "froam-collab", ref: rootRef, "data-chef-editor-root": "true", children: [props.needsName && typeof document !== 'undefined' && createPortal(_jsx(JoinPrompt, { role: role, onJoin: props.onJoin }), document.getElementById('froam-editor-portal') ?? document.body), _jsxs("button", { type: "button", className: `froam-collab__trigger${open ? ' is-open' : ''}`, onClick: () => setOpen((value) => !value), "aria-expanded": open, "aria-haspopup": "dialog", title: isContributor ? 'Your suggested changes' : 'Share and review', "data-chef-editor-root": "true", children: [here.length > 0 && (_jsxs("span", { className: "froam-collab__faces", children: [here.slice(0, 3).map((person) => _jsx(Avatar, { name: person.name, color: person.color }, person.actor)), here.length > 3 && _jsxs("span", { className: "froam-collab__more", children: ["+", here.length - 3] })] })), isContributor ? _jsx(Send, { size: 13 }) : _jsx(Users, { size: 13 }), _jsx("span", { children: isContributor ? 'Submit' : 'Share' }), (isOwner ? pending.length : isContributor ? props.pendingChanges.length : 0) > 0 && (_jsx("span", { className: "froam-collab__badge", "aria-label": isOwner ? `${pending.length} waiting for approval` : `${props.pendingChanges.length} changes`, children: isOwner ? pending.length : props.pendingChanges.length }))] }), open && typeof document !== 'undefined' && createPortal(_jsx("div", { className: "froam-collab__panel", ref: panelRef, style: place, role: "dialog", "aria-label": isContributor ? 'Submit your changes' : 'Share and review', "data-chef-editor-root": "true", children: isContributor ? (_jsxs(_Fragment, { children: [_jsxs("header", { className: "froam-collab__head", children: [_jsx("strong", { children: "Suggest changes" }), _jsx("button", { type: "button", className: "froam-collab__icon", onClick: () => setOpen(false), "aria-label": "Close", children: _jsx(X, { size: 14 }) })] }), _jsxs("p", { className: "froam-collab__intro", children: ["Edit anything on the page. Nothing goes live until the owner approves it.", _jsxs("button", { type: "button", className: "froam-collab__link", onClick: props.onEditName, children: ["You\u2019re \u201C", props.myName, "\u201D"] })] }), _jsxs("section", { className: "froam-collab__section", children: [_jsxs("h4", { children: ["Your changes ", _jsx("small", { children: props.pendingChanges.length })] }), _jsx(ChangeList, { changes: props.pendingChanges }), _jsx("input", { className: "froam-collab__input", value: title, onChange: (event) => setTitle(event.target.value), placeholder: "What is this? e.g. Spring sale copy", "aria-label": "Title for your changes", maxLength: 120 }), _jsx("textarea", { className: "froam-collab__input", value: note, onChange: (event) => setNote(event.target.value), placeholder: "Anything the owner should know (optional)", "aria-label": "Note for the owner", rows: 2 }), _jsxs("button", { type: "button", className: "froam-collab__primary", disabled: !props.pendingChanges.length || submitting, onClick: () => void submit(), children: [_jsx(Send, { size: 13 }), " ", submitting ? 'Sending…' : 'Submit for approval'] })] }), requests.length > 0 && (_jsxs("section", { className: "froam-collab__section", children: [_jsx("h4", { children: "Sent" }), requests.map((request) => (_jsxs("article", { className: `froam-collab__request is-${request.status}`, children: [_jsxs("div", { className: "froam-collab__request-head", children: [_jsx("strong", { children: request.title }), _jsx("span", { className: "froam-collab__status", children: STATUS_LABEL[request.status] })] }), _jsxs("small", { children: [relativeTime(request.decidedAt ?? request.createdAt), request.decidedBy ? ` · ${request.decidedBy}` : ''] }), request.decisionNote && _jsxs("blockquote", { children: ["\u201C", request.decisionNote, "\u201D"] }), request.status === 'pending' && (_jsx("button", { type: "button", className: "froam-collab__ghost", onClick: () => props.onWithdraw(request), children: "Withdraw" }))] }, request.id)))] }))] })) : (_jsxs(_Fragment, { children: [_jsxs("header", { className: "froam-collab__head", children: [_jsxs("div", { className: "froam-collab__tabs", role: "tablist", children: [_jsx("button", { type: "button", role: "tab", "aria-selected": tab === 'share', className: tab === 'share' ? 'is-active' : '', onClick: () => setTab('share'), children: "Share" }), isOwner && (_jsxs("button", { type: "button", role: "tab", "aria-selected": tab === 'requests', className: tab === 'requests' ? 'is-active' : '', onClick: () => setTab('requests'), children: ["Requests", pending.length ? _jsx("span", { className: "froam-collab__badge", children: pending.length }) : null] }))] }), _jsx("button", { type: "button", className: "froam-collab__icon", onClick: () => setOpen(false), "aria-label": "Close", children: _jsx(X, { size: 14 }) })] }), tab === 'share' && (!inRoom ? (_jsxs("section", { className: "froam-collab__section froam-collab__empty", children: [_jsx(Link2, { size: 22 }), _jsx("strong", { children: "Bring people in" }), _jsx("p", { children: "Anyone with a link can join \u2014 no account needed. You choose what each link can do." }), _jsx("button", { type: "button", className: "froam-collab__primary", disabled: props.opening, onClick: () => props.onOpenRoom(false), children: props.opening ? 'Opening…' : 'Create invite links' })] })) : (_jsxs(_Fragment, { children: [needsFreshLinks && (_jsxs("p", { className: "froam-collab__notice", children: ["This room predates \u201CCan suggest changes\u201D.", ' ', _jsx("button", { type: "button", className: "froam-collab__link", onClick: () => props.onOpenRoom(true), children: "Create new links" })] })), _jsxs("section", { className: "froam-collab__section", children: [INVITES.map((invite) => {
                                            const link = props.links[invite.role];
                                            return (_jsxs("div", { className: "froam-collab__invite", children: [_jsxs("div", { children: [_jsx("strong", { children: invite.title }), _jsx("p", { children: invite.body })] }), _jsx("button", { type: "button", className: "froam-collab__copy", disabled: !link, onClick: () => link && copy(link, invite.role), "aria-label": `Copy the “${invite.title}” link`, children: copiedRole === invite.role ? _jsxs(_Fragment, { children: [_jsx(Check, { size: 12 }), " Copied"] }) : _jsxs(_Fragment, { children: [_jsx(Copy, { size: 12 }), " Copy link"] }) })] }, invite.role));
                                        }), isOwner && (_jsxs("button", { type: "button", className: "froam-collab__ghost", onClick: () => props.onOpenRoom(true), children: [_jsx(RefreshCw, { size: 12 }), " Reset links (old ones stop working)"] }))] }), _jsxs("section", { className: "froam-collab__section", children: [_jsxs("h4", { children: ["People ", _jsxs("small", { children: [here.length, " here"] })] }), people.length === 0 ? (_jsx("p", { className: "froam-collab__muted", children: "Nobody has joined yet." })) : (_jsx("ul", { className: "froam-collab__people", children: people.map((person) => (_jsxs("li", { children: [_jsx(Avatar, { name: person.name, color: person.color, here: person.here }), _jsxs("span", { className: "froam-collab__person", children: [_jsx("strong", { children: person.name }), _jsxs("small", { children: [ROLE_LABEL[person.role], person.here ? (person.routeKey ? ` · on ${person.routeKey}` : ' · here') : ' · away'] })] })] }, person.actor))) }))] })] }))), tab === 'requests' && isOwner && (_jsxs("section", { className: "froam-collab__section", children: [requests.length === 0 && _jsx("p", { className: "froam-collab__muted", children: "No requests yet. Send a \u201CCan suggest changes\u201D link to someone who isn\u2019t a developer \u2014 what they submit lands here." }), requests.map((request) => {
                                    const previewing = props.previewingId === request.id;
                                    return (_jsxs("article", { className: `froam-collab__request is-${request.status}`, children: [_jsxs("div", { className: "froam-collab__request-head", children: [_jsx("strong", { children: request.title }), _jsx("span", { className: "froam-collab__status", children: STATUS_LABEL[request.status] })] }), _jsxs("small", { children: [request.createdBy, " \u00B7 ", relativeTime(request.createdAt), " \u00B7 ", request.routeKey] }), request.note && _jsxs("blockquote", { children: ["\u201C", request.note, "\u201D"] }), _jsx(ChangeList, { changes: request.changes }), request.published?.detail && request.status === 'approved' && _jsx("p", { className: "froam-collab__muted", children: request.published.detail }), request.decisionNote && request.status !== 'pending' && _jsxs("blockquote", { children: ["You: \u201C", request.decisionNote, "\u201D"] }), request.status === 'pending' && (replyFor === request.id ? (_jsxs("div", { className: "froam-collab__reply", children: [_jsx("textarea", { className: "froam-collab__input", value: reply, onChange: (event) => setReply(event.target.value), placeholder: "What should change?", "aria-label": "What should change", rows: 2, autoFocus: true }), _jsxs("div", { className: "froam-collab__actions", children: [_jsx("button", { type: "button", className: "froam-collab__ghost", onClick: () => { setReplyFor(null); setReply(''); }, children: "Cancel" }), _jsx("button", { type: "button", className: "froam-collab__secondary", disabled: deciding === request.id, onClick: () => void decide(request, 'changes-requested'), children: "Send back" })] })] })) : (_jsxs("div", { className: "froam-collab__actions", children: [_jsx("button", { type: "button", className: "froam-collab__ghost", onClick: () => props.onPreview(previewing ? null : request), "aria-pressed": previewing, children: previewing ? _jsxs(_Fragment, { children: [_jsx(EyeOff, { size: 12 }), " Stop preview"] }) : _jsxs(_Fragment, { children: [_jsx(Eye, { size: 12 }), " Preview"] }) }), _jsx("button", { type: "button", className: "froam-collab__secondary", onClick: () => setReplyFor(request.id), children: "Request changes" }), _jsxs("button", { type: "button", className: "froam-collab__primary", disabled: deciding === request.id, onClick: () => void decide(request, 'approved'), children: [_jsx(Check, { size: 13 }), " ", deciding === request.id ? 'Publishing…' : 'Approve & publish'] })] })))] }, request.id));
                                })] }))] })) }), document.getElementById('froam-editor-portal') ?? document.body)] }));
}
//# sourceMappingURL=FroamCollaborate.js.map