/** Heartbeat well inside the server's 45s window, so one dropped beat is survivable. */
export const ROOM_BEAT_MS = 15_000;
/* ─── the invite in the URL ─── */
export const ROOM_PARAM = 'froam-room';
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
    const { roomId, token, transport } = options;
    const storage = options.storage ?? browserStorage();
    const isHidden = options.isHidden ?? (() => typeof document !== 'undefined' && document.hidden);
    const key = `froam-room:${roomId}`;
    let identity = readIdentity();
    let room = null;
    let timer = null;
    let liveTimer = null;
    let liveUnsubscribe = null;
    let cursor = 0;
    let polling = false;
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
        const next = payload?.room;
        if (next && Array.isArray(next.members)) {
            room = next;
            announce();
        }
        return room;
    }
    return {
        get roomId() { return roomId; },
        get identity() { return identity; },
        get room() { return room; },
        get cursor() { return cursor; },
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
                avatarUrl: profile.avatarUrl,
            });
            if (!payload?.you?.actor)
                throw new Error('Could not join the room');
            remember(payload.you);
            adopt(payload);
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
            liveTimer = setInterval(() => { if (!isHidden())
                void this.pollEvents(); }, everyMs);
            return () => this.stopLive();
        },
        stopLive() {
            if (liveTimer)
                clearInterval(liveTimer);
            liveTimer = null;
            liveUnsubscribe?.();
            liveUnsubscribe = null;
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
        async sendChat(body) {
            const payload = await post(`/api/froam/rooms/${roomId}/chat`, {
                token, ...credentials(), body,
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
    };
}
//# sourceMappingURL=room.js.map