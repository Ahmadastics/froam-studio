import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
export default function FroamRoomChat({ client, events, role }) {
    const [messages, setMessages] = useState([]);
    const [proposals, setProposals] = useState([]);
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const refresh = useCallback(async () => {
        if (!client?.joined)
            return;
        try {
            const [nextMessages, nextProposals] = await Promise.all([
                client.chat(),
                role === 'owner' || role === 'editor' ? client.proposals() : Promise.resolve([]),
            ]);
            setMessages(nextMessages);
            setProposals(nextProposals);
        }
        catch { /* reconnect polling will try again */ }
    }, [client, role]);
    useEffect(() => { void refresh(); }, [refresh, events]);
    const send = useCallback(async () => {
        const body = draft.trim();
        if (!body || !client)
            return;
        setSending(true);
        try {
            await client.sendChat(body);
            setDraft('');
            await refresh();
        }
        finally {
            setSending(false);
        }
    }, [client, draft, refresh]);
    const decide = useCallback(async (id, decision) => {
        if (!client)
            return;
        await client.decideProposal(id, decision);
        await refresh();
    }, [client, refresh]);
    if (!client?.joined)
        return null;
    return (_jsxs("div", { className: "froam-room-chat", "data-chef-editor-root": "true", children: [role === 'owner' && proposals.some((proposal) => proposal.status === 'pending') && (_jsx("div", { className: "froam-room-chat__messages", children: proposals.filter((proposal) => proposal.status === 'pending').map((proposal) => (_jsxs("div", { className: "froam-room-chat__message froam-proposal", children: [_jsxs("strong", { children: [proposal.name, " wants to undo someone else\u2019s change"] }), _jsxs("div", { className: "froam-note__row", children: [_jsx("button", { type: "button", className: "fs-pill is-accent", onClick: () => void decide(proposal.id, 'approved'), children: "Allow" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => void decide(proposal.id, 'declined'), children: "Keep change" })] })] }, proposal.id))) })), _jsxs("div", { className: "froam-room-chat__messages", "aria-live": "polite", children: [messages.length === 0 && _jsx("span", { style: { color: 'var(--fs-text-tertiary)', fontSize: '.72rem' }, children: "Room chat is quiet" }), messages.map((message) => (_jsxs("div", { className: "froam-room-chat__message", children: [_jsx("strong", { children: message.name }), message.body] }, message.id)))] }), _jsxs("form", { className: "froam-room-chat__composer", onSubmit: (event) => { event.preventDefault(); void send(); }, children: [_jsx("input", { className: "fs-input", value: draft, maxLength: 2_000, placeholder: "Message the room", "aria-label": "Message the room", onChange: (event) => setDraft(event.target.value) }), _jsx("button", { type: "submit", className: "fs-pill is-accent", disabled: sending || !draft.trim(), children: "Send" })] })] }));
}
//# sourceMappingURL=FroamRoomChat.js.map