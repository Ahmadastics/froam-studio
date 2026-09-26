import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
const readKey = (roomId) => `froam-room-read:${roomId}`;
function readSeen(roomId) {
    if (!roomId)
        return 0;
    try {
        return Number(window.localStorage.getItem(readKey(roomId)) ?? 0) || 0;
    }
    catch {
        return 0;
    }
}
function byTime(a, b) {
    return a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1);
}
/**
 * The room's conversation, kept live from the event stream.
 *
 * Chat events carry the message itself, so a new message costs no request;
 * the full list is read once on joining and again only to heal a gap.
 */
export function useRoomMessages({ client, events, roomId, role, me }) {
    const [sent, setSent] = useState([]);
    const [local, setLocal] = useState([]);
    const [proposals, setProposals] = useState([]);
    const [seenAt, setSeenAt] = useState(() => readSeen(roomId));
    const joined = Boolean(client?.joined && me);
    const moderates = role === 'owner' || role === 'editor';
    const handledRef = useRef(new WeakSet());
    useEffect(() => { setSeenAt(readSeen(roomId)); }, [roomId]);
    const load = useCallback(async () => {
        if (!client?.joined)
            return;
        try {
            const [messages, nextProposals] = await Promise.all([
                client.chat(),
                moderates ? client.proposals() : Promise.resolve([]),
            ]);
            setSent([...messages].sort(byTime));
            setProposals(nextProposals);
        }
        catch { /* the next event or reconnect heals it */ }
    }, [client, moderates]);
    useEffect(() => { if (joined)
        void load(); }, [joined, load]);
    useEffect(() => {
        let incoming = [];
        let proposalsChanged = false;
        for (const event of events) {
            if (handledRef.current.has(event))
                continue;
            handledRef.current.add(event);
            if (event.type === 'chat' && event.message)
                incoming.push(event.message);
            if (event.type === 'proposal')
                proposalsChanged = true;
        }
        if (incoming.length) {
            setSent((current) => {
                const known = new Set(current.map((message) => message.id));
                incoming = incoming.filter((message) => !known.has(message.id));
                return incoming.length ? [...current, ...incoming].sort(byTime) : current;
            });
        }
        if (proposalsChanged && moderates && client?.joined) {
            void client.proposals().then(setProposals).catch(() => { });
        }
    }, [events, client, moderates, me]);
    const deliver = useCallback(async (draft, requestId) => {
        if (!client)
            return false;
        setLocal((current) => [...current.filter((message) => message.id !== draft.id), { ...draft, state: 'sending' }]);
        const about = requestId ?? draft.requestId ?? null;
        try {
            // One quiet second try: a busy room or a blip on the network shouldn't
            // be the person's problem. Only a second failure asks them.
            const message = await client.sendChat(draft.body, about).catch(async () => {
                await new Promise((resolve) => setTimeout(resolve, 700));
                return client.sendChat(draft.body, about);
            });
            setLocal((current) => current.filter((item) => item.id !== draft.id));
            if (message)
                setSent((current) => (current.some((item) => item.id === message.id) ? current : [...current, message].sort(byTime)));
            return true;
        }
        catch {
            setLocal((current) => current.map((item) => (item.id === draft.id ? { ...item, state: 'failed' } : item)));
            return false;
        }
    }, [client]);
    const send = useCallback(async (body, requestId) => {
        const text = body.trim();
        if (!text || !me)
            return false;
        const draft = {
            id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
            actor: me,
            name: '',
            body: text,
            createdAt: Date.now(),
            ...(requestId ? { requestId } : {}),
        };
        return deliver(draft, requestId);
    }, [deliver, me]);
    const retry = useCallback((message) => deliver(message), [deliver]);
    const messages = useMemo(() => [...sent, ...local], [sent, local]);
    const fromOthers = useMemo(() => sent.filter((message) => message.actor !== me), [sent, me]);
    const unread = useMemo(() => fromOthers.filter((message) => message.createdAt > seenAt).length, [fromOthers, seenAt]);
    const latestIncoming = fromOthers.length ? fromOthers[fromOthers.length - 1] : null;
    const markRead = useCallback(() => {
        const newest = sent.length ? sent[sent.length - 1].createdAt : 0;
        if (!roomId || newest <= seenAt)
            return;
        setSeenAt(newest);
        try {
            window.localStorage.setItem(readKey(roomId), String(newest));
        }
        catch { /* private mode */ }
    }, [roomId, sent, seenAt]);
    const decideProposal = useCallback(async (id, decision) => {
        if (!client)
            return;
        await client.decideProposal(id, decision);
        setProposals(await client.proposals().catch(() => []));
    }, [client]);
    return { messages, proposals, unread, latestIncoming, send, retry, markRead, decideProposal };
}
//# sourceMappingURL=useRoomMessages.js.map