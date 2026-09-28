/** Every scope of a request, including one made before requests could span pages. */
export function scopesOf(request) {
    return request.scopes?.length ? request.scopes : [{ routeKey: request.routeKey, viewport: request.viewport, store: request.store, removed: request.removed }];
}
/** Heartbeat well inside the server's 45s window, so one dropped beat is survivable. */
export const ROOM_BEAT_MS = 15_000;
/* ─── the invite in the URL ─── */
export const ROOM_PARAM = 'froam-room';
/** Fired on window when this browser joins a room (detail: { roomId, role }). */
export const ROOM_IDENTITY_EVENT = 'froam:room-identity';
export const TOKEN_PARAM = 'froam-token';
/**
 * An invite is a link, so the link is where the room comes from.
 *
 * The token is a bearer credential sitting in a URL — which is the deliberate
 * trade that makes "tap this and you're in" possible at all. It is scoped to
 * one room and revocable by deleting it, and it is why nothing sensitive
 * beyond that design should ever live behind one.
 */
export function readRoomFromLocation(href) {
    try {
        const url = new URL(href ?? (typeof window === 'undefined' ? '' : window.location.href));
        const roomId = url.searchParams.get(ROOM_PARAM);
        const token = url.searchParams.get(TOKEN_PARAM);
        return roomId && token ? { roomId, token } : null;
    }
    catch {
        return null;
    }
}
/* ─── the room you own ─── */
const OWNED_KEY = 'froam-room-owner:v1';
/**
 * The designer should not have to paste their own invite into their own
 * browser. They made the room, so the browser remembers it and they are simply
 * in it — the link exists to be given away, not to be kept.
 */
export function readOwnedRoom() {
    try {
        if (typeof window === 'undefined')
            return null;
        const raw = window.localStorage.getItem(OWNED_KEY);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        return parsed?.roomId && parsed?.invites?.commenter ? parsed : null;
    }
    catch {
        return null;
    }
}
export function rememberOwnedRoom(room) {
    try {
        if (typeof window !== 'undefined')
            window.localStorage.setItem(OWNED_KEY, JSON.stringify(room));
    }
    catch { /* private mode */ }
}
export function rememberRoomIdentity(roomId, identity) {
    try {
        if (typeof window !== 'undefined')
            window.localStorage.setItem(`froam-room:${roomId}`, JSON.stringify(identity));
    }
    catch { /* private mode */ }
}
/** The role this browser joined a room with, if it has — from any surface. */
export function readRememberedRole(roomId) {
    try {
        if (typeof window === 'undefined')
            return null;
        const raw = window.localStorage.getItem(`froam-room:${roomId}`);
        return raw ? JSON.parse(raw).role ?? null : null;
    }
    catch {
        return null;
    }
}
export function forgetOwnedRoom() {
    try {
        if (typeof window !== 'undefined')
            window.localStorage.removeItem(OWNED_KEY);
    }
    catch { /* nothing to do */ }
}
/** The link you actually send someone, for a given role and page. */
export function inviteLink(room, role = 'commenter', href) {
    const url = new URL(href ?? (typeof window === 'undefined' ? 'http://localhost/' : window.location.href));
    url.searchParams.set(ROOM_PARAM, room.roomId);
    url.searchParams.set(TOKEN_PARAM, room.invites[role]);
    return url.toString();
}
/* ─── defaults ─── */
function browserStorage() {
    return {
        read(key) {
            try {
                return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
            }
            catch {
                return null;
            }
        },
        write(key, value) {
            try {
                if (typeof window !== 'undefined')
                    window.localStorage.setItem(key, value);
            }
            catch { /* private mode */ }
        },
    };
}
/* ─── the client ─── */
export function createRoomClient(options) {
    const { roomId, token } = options;
    // Every answer is checked for "this session has ended", wherever it comes from.
    const transport = {
        ...options.transport,
        get: (path) => watchEnded(options.transport.get(path)),
        post: (path, body) => watchEnded(options.transport.post(path, body)),
    };
    const storage = options.storage ?? browserStorage();
    const isHidden = options.isHidden ?? (() => typeof document !== 'undefined' && document.hidden);
    const key = `froam-room:${roomId}`;
    let identity = readIdentity();
    let room = null;
    let invite = null;
    let timer = null;
    let liveTimer = null;
    let liveUnsubscribe = null;
    let cursor = 0;
    let polling = false;
    // The room's relay (lib/realtime.mjs), when the host has one: a socket that
    // says "read now" and carries presence between people without storing it.
    let realtime = null;
    let socket = null;
    let socketWanted = false;
    let socketRetry = null;
    let socketAttempts = 0;
    let lastPoll = 0;
    let lastHttpBeat = 0;
    /** Presence heard over the socket, newer than the last stored heartbeat. */
    const livePresence = new Map();
    const listeners = new Set();
    const eventListeners = new Set();
    function readIdentity() {
        const raw = storage.read(key);
        if (!raw)
            return null;
        try {
            const parsed = JSON.parse(raw);
            return parsed?.actor && parsed?.name && parsed?.session ? parsed : null;
        }
        catch {
            return null;
        }
    }
    function remember(next) {
        identity = next;
        storage.write(key, JSON.stringify(next));
    }
    function announce() {
        for (const listener of listeners)
            listener(room);
    }
    function announceEvents(events) {
        if (!events.length)
            return;
        for (const listener of eventListeners)
            listener(events);
        if (typeof window !== 'undefined') {
            for (const event of events) {
                if (event.type === 'design')
                    window.dispatchEvent(new CustomEvent('froam:design-published', { detail: event }));
            }
        }
    }
    function identityQuery() {
        if (!identity)
            return '';
        return `&actor=${encodeURIComponent(identity.actor)}&session=${encodeURIComponent(identity.session)}`;
    }
    function credentials() {
        if (!identity)
            throw new Error('Join the room first');
        return { actor: identity.actor, session: identity.session };
    }
    let ended = null;
    async function watchEnded(pending) {
        try {
            const payload = await pending;
            if (payload && payload.ended === true && payload.success === false)
                markEnded(payload.endedAt, payload.error);
            return payload;
        }
        catch (error) {
            if (Number(error?.status) === 410)
                markEnded(undefined, error.message);
            throw error;
        }
    }
    /** The room is over: stop listening, and tell everyone watching this client. */
    function markEnded(at, message) {
        if (ended)
            return;
        ended = { at: at ?? Date.now(), by: message?.replace(/ ended this session.*$/, '') ?? null };
        socketWanted = false;
        if (timer)
            clearInterval(timer);
        if (liveTimer)
            clearInterval(liveTimer);
        timer = null;
        liveTimer = null;
        try {
            socket?.close();
        }
        catch { /* closed */ }
        socket = null;
        room = { ...(room ?? { id: roomId, routes: '*', createdAt: 0, members: [], presenter: null, sequence: 0, you: null }), endedAt: ended.at, endedBy: ended.by };
        announce();
    }
    async function post(path, body) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
                return await transport.post(path, body);
            }
            catch (error) {
                if (Number(error?.status) !== 409 || attempt === 2)
                    throw error;
                await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
            }
        }
        throw new Error('Could not update the room');
    }
    function adopt(payload) {
        const granted = payload?.invite;
        if (granted)
            invite = granted;
        const offered = payload?.realtime;
        if (offered?.url && offered.ticket && (offered.url !== realtime?.url || !socket)) {
            realtime = { url: offered.url, ticket: offered.ticket };
            if (socketWanted)
                connectSocket();
        }
        const next = payload?.room;
        if (next && Array.isArray(next.members)) {
            room = withLivePresence(next);
            announce();
        }
        return room;
    }
    /** Stored presence can lag the socket by a heartbeat; what the socket said last wins. */
    function withLivePresence(view) {
        if (!livePresence.size)
            return view;
        const now = Date.now();
        return {
            ...view,
            members: view.members.map((member) => {
                const live = livePresence.get(member.actor);
                if (!live || now - live.at > 30_000)
                    return member;
                return { ...member, ...live.presence, here: true, seenAt: live.at };
            }),
        };
    }
    function connectSocket() {
        if (typeof WebSocket === 'undefined' || !realtime || !identity)
            return;
        try {
            socket?.close();
        }
        catch { /* already closed */ }
        const current = new WebSocket(`${realtime.url}?ticket=${encodeURIComponent(realtime.ticket)}`);
        socket = current;
        current.onopen = () => { socketAttempts = 0; };
        current.onmessage = (event) => {
            let frame = null;
            try {
                frame = JSON.parse(String(event.data));
            }
            catch {
                return;
            }
            if (frame?.type === 'wake')
                void client.pollEvents();
            else if (frame?.type === 'presence' && frame.actor && frame.presence) {
                livePresence.set(frame.actor, { presence: frame.presence, at: Date.now() });
                if (room) {
                    room = withLivePresence(room);
                    announce();
                }
            }
            else if (frame?.type === 'leave' && frame.actor) {
                livePresence.delete(frame.actor);
                if (room) {
                    room = { ...room, members: room.members.map((member) => (member.actor === frame.actor ? { ...member, here: false } : member)) };
                    announce();
                }
            }
        };
        current.onclose = () => {
            if (socket === current)
                socket = null;
            if (!socketWanted)
                return;
            // Back off, then try again; polling carries the room in the meantime.
            socketAttempts += 1;
            socketRetry = setTimeout(connectSocket, Math.min(30_000, 1_000 * 2 ** Math.min(socketAttempts, 5)));
        };
    }
    const socketOpen = () => socket?.readyState === 1;
    const client = {
        get roomId() { return roomId; },
        get identity() { return identity; },
        get room() { return room; },
        get cursor() { return cursor; },
        /** What the link in hand grants — known before joining, so a page can tell a studio invite from a client's. */
        get inviteRole() { return invite; },
        /** Have we already been someone in this room? Decides whether to ask for a name. */
        get joined() { return identity !== null; },
        on(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        onEvents(listener) {
            eventListeners.add(listener);
            return () => eventListeners.delete(listener);
        },
        /**
         * Become somebody. Reuses the actor from a previous visit when there is
         * one, so a refresh keeps your comments yours instead of minting a
         * stranger who happens to have the same name.
         */
        async join(name, profile = {}) {
            const payload = await post(`/api/froam/rooms/${roomId}/join`, {
                token,
                name,
                actor: identity?.actor,
                session: identity?.session,
                ...profile,
            });
            if (!payload?.you?.actor)
                throw new Error('Could not join the room');
            remember(payload.you);
            adopt(payload);
            // Other surfaces on this page (the client review bar) hold their own
            // client; tell them who this browser now is in the room.
            if (typeof window !== 'undefined')
                window.dispatchEvent(new CustomEvent(ROOM_IDENTITY_EVENT, { detail: { roomId, role: payload.you.role } }));
            return payload.you;
        },
        /** Read the room without changing anything. */
        async refresh() {
            return adopt(await transport.get(`/api/froam/rooms/${roomId}?token=${encodeURIComponent(token)}${identityQuery()}`));
        },
        /**
         * Say you are still here, and where.
         *
         * Skipped while the tab is hidden — presence should mean "someone is
         * looking", and a heartbeat from a buried tab would keep a phone following
         * a laptop nobody is sitting at.
         */
        async beat(where = {}) {
            if (!identity || isHidden())
                return room;
            if (socketOpen()) {
                try {
                    socket.send(JSON.stringify({ type: 'presence', presence: where }));
                }
                catch { /* reconnecting */ }
                // The relay carries it to everyone now; the stored heartbeat only keeps us "here".
                if (Date.now() - lastHttpBeat < 30_000)
                    return room;
            }
            lastHttpBeat = Date.now();
            try {
                return adopt(await post(`/api/froam/rooms/${roomId}/presence`, {
                    token,
                    ...credentials(),
                    ...where,
                }));
            }
            catch {
                // A dropped beat is not an error worth surfacing; the next one carries
                // the same information and presence lapses on its own if it doesn't.
                return room;
            }
        },
        start(where, everyMs = ROOM_BEAT_MS) {
            this.stop();
            void this.beat(where());
            timer = setInterval(() => { void this.beat(where()); }, everyMs);
            return () => this.stop();
        },
        stop() {
            if (timer)
                clearInterval(timer);
            timer = null;
        },
        async pollEvents() {
            if (polling)
                return [];
            polling = true;
            lastPoll = Date.now();
            try {
                const payload = await transport.get(`/api/froam/rooms/${roomId}/events?token=${encodeURIComponent(token)}&after=${cursor}${identityQuery()}`);
                adopt(payload);
                const events = Array.isArray(payload.events) ? payload.events : [];
                if (Number.isFinite(payload.cursor))
                    cursor = Math.max(cursor, Number(payload.cursor));
                announceEvents(events);
                if (payload.hasMore)
                    queueMicrotask(() => { void this.pollEvents(); });
                return events;
            }
            finally {
                polling = false;
            }
        },
        startLive(everyMs = 4_000) {
            this.stopLive();
            void this.pollEvents();
            if (transport.subscribe) {
                const path = `/api/froam/rooms/${roomId}/stream?token=${encodeURIComponent(token)}${identityQuery()}`;
                liveUnsubscribe = transport.subscribe(path, () => { if (!isHidden())
                    void this.pollEvents(); });
            }
            // With a relay the socket says when to read; the timer is only a safety net.
            liveTimer = setInterval(() => {
                if (isHidden())
                    return;
                if (socketOpen() && Date.now() - lastPoll < 30_000)
                    return;
                void this.pollEvents();
            }, everyMs);
            socketWanted = true;
            if (realtime && !socket)
                connectSocket();
            return () => this.stopLive();
        },
        stopLive() {
            if (liveTimer)
                clearInterval(liveTimer);
            liveTimer = null;
            liveUnsubscribe?.();
            liveUnsubscribe = null;
            socketWanted = false;
            if (socketRetry)
                clearTimeout(socketRetry);
            socketRetry = null;
            try {
                socket?.close();
            }
            catch { /* already closed */ }
            socket = null;
        },
        async pushOps(ops) {
            const pending = ops.filter((op) => op.actor === identity?.actor);
            if (!pending.length)
                return { accepted: [], rejected: [] };
            const payload = await post(`/api/froam/rooms/${roomId}/ops`, {
                token, ...credentials(), baseSeq: cursor, ops: pending,
            });
            adopt(payload);
            return { accepted: payload.accepted ?? [], rejected: payload.rejected ?? [] };
        },
        /* ─── derived ─── */
        /** Everyone but you. */
        others() {
            if (!room)
                return [];
            return room.members.filter((m) => m.actor !== identity?.actor);
        },
        /** Everyone but you, who is actually here. */
        present() {
            return this.others().filter((m) => m.here);
        },
        presenter() {
            if (!room?.presenter)
                return null;
            return room.members.find((m) => m.actor === room?.presenter) ?? null;
        },
        /** Is someone else driving? The question v5.1's follow mode turns on. */
        someoneElseIsPresenting() {
            const driver = this.presenter();
            return Boolean(driver && driver.actor !== identity?.actor);
        },
        role() {
            return identity?.role ?? null;
        },
        /* ─── notes ─── */
        async comments(routeKey) {
            const params = new URLSearchParams({ token, routeKey });
            if (identity) {
                params.set('actor', identity.actor);
                params.set('session', identity.session);
            }
            const payload = await transport.get(`/api/froam/rooms/${roomId}/comments?${params}`);
            return payload?.comments ?? [];
        },
        async comment(input) {
            if (!identity)
                throw new Error('Join the room first');
            const payload = await post(`/api/froam/rooms/${roomId}/comments`, {
                token, ...credentials(), ...input,
            });
            return payload?.comment ?? null;
        },
        /* ─── revisions ─── */
        async revisions(routeKey) {
            const params = new URLSearchParams({ token, routeKey });
            if (identity) {
                params.set('actor', identity.actor);
                params.set('session', identity.session);
            }
            const payload = await transport.get(`/api/froam/rooms/${roomId}/revisions?${params}`);
            return payload?.revisions ?? [];
        },
        async sendRevision(input) {
            if (!identity)
                throw new Error('Join the room first');
            const payload = await post(`/api/froam/rooms/${roomId}/revisions`, {
                token, ...credentials(), ...input,
            });
            return payload?.revision ?? null;
        },
        async decide(revisionId, decision, note) {
            if (!identity)
                throw new Error('Join the room first');
            const payload = await post(`/api/froam/rooms/${roomId}/revisions/${revisionId}/decision`, {
                token, ...credentials(), decision, note,
            });
            return payload?.revision ?? null;
        },
        /* ─── change requests ─── */
        async requests() {
            if (!identity)
                return [];
            const params = new URLSearchParams({ token, actor: identity.actor, session: identity.session });
            const payload = await transport.get(`/api/froam/rooms/${roomId}/requests?${params}`);
            return payload?.requests ?? [];
        },
        async submitRequest(input) {
            if (!identity)
                throw new Error('Join the room first');
            const payload = await post(`/api/froam/rooms/${roomId}/requests`, { token, ...credentials(), ...input });
            return payload?.request ?? null;
        },
        async withdrawRequest(requestId) {
            if (!identity)
                throw new Error('Join the room first');
            const payload = await post(`/api/froam/rooms/${roomId}/requests/${requestId}/withdraw`, { token, ...credentials() });
            return payload?.request ?? null;
        },
        async decideRequest(requestId, decision, note) {
            if (!identity)
                throw new Error('Join the room first');
            const payload = await post(`/api/froam/rooms/${roomId}/requests/${requestId}/decision`, { token, ...credentials(), decision, note });
            return payload?.request ?? null;
        },
        /** The owner takes an approved change back (the host decides how — close a pull request, open a revert). */
        async revertRequest(requestId, note) {
            if (!identity)
                throw new Error('Join the room first');
            const payload = await post(`/api/froam/rooms/${roomId}/requests/${requestId}/revert`, { token, ...credentials(), note });
            return payload?.request ?? null;
        },
        async resolveComment(commentId, resolved = true) {
            if (!identity)
                throw new Error('Join the room first');
            const payload = await post(`/api/froam/rooms/${roomId}/comments/${commentId}/resolve`, {
                token, ...credentials(), resolved,
            });
            return payload?.comment ?? null;
        },
        async chat() {
            if (!identity)
                return [];
            const params = new URLSearchParams({ token, actor: identity.actor, session: identity.session });
            const payload = await transport.get(`/api/froam/rooms/${roomId}/chat?${params}`);
            return payload.messages ?? [];
        },
        async sendChat(body, about = null) {
            const { requestId = null, anchor = null } = typeof about === 'string' ? { requestId: about } : about ?? {};
            const payload = await post(`/api/froam/rooms/${roomId}/chat`, {
                token, ...credentials(), body, ...(requestId ? { requestId } : {}), ...(anchor ? { anchor } : {}),
            });
            return payload.message ?? null;
        },
        async signalDesign(routeKey, viewport) {
            await post(`/api/froam/rooms/${roomId}/signal`, {
                token, ...credentials(), routeKey, viewport,
            });
        },
        async proposals() {
            if (!identity)
                return [];
            const params = new URLSearchParams({ token, actor: identity.actor, session: identity.session });
            const payload = await transport.get(`/api/froam/rooms/${roomId}/proposals?${params}`);
            return payload.proposals ?? [];
        },
        async decideProposal(proposalId, decision) {
            const payload = await post(`/api/froam/rooms/${roomId}/proposals/${proposalId}/decision`, {
                token, ...credentials(), decision,
            });
            return payload;
        },
        /** Is the room's relay connected (instant updates and live presence)? */
        get live() { return socketOpen(); },
        /** Has the owner ended this session? */
        get ended() { return ended; },
        /** The owner is done: every link stops working, and everyone in the room is told. */
        async endRoom() {
            if (!identity)
                throw new Error('Join the room first');
            const payload = await post(`/api/froam/rooms/${roomId}/end`, { token, ...credentials() });
            if (payload?.success)
                markEnded(payload.endedAt, `${identity.name} ended this session`);
            return Boolean(payload?.success);
        },
    };
    return client;
}
//# sourceMappingURL=room.js.map