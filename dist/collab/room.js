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
    const listeners = new Set();
    function readIdentity() {
        const raw = storage.read(key);
        if (!raw)
            return null;
        try {
            const parsed = JSON.parse(raw);
            return parsed?.actor && parsed?.name ? parsed : null;
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
        /** Have we already been someone in this room? Decides whether to ask for a name. */
        get joined() { return identity !== null; },
        on(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        /**
         * Become somebody. Reuses the actor from a previous visit when there is
         * one, so a refresh keeps your comments yours instead of minting a
         * stranger who happens to have the same name.
         */
        async join(name) {
            const payload = await transport.post(`/api/froam/rooms/${roomId}/join`, {
                token,
                name,
                actor: identity?.actor,
            });
            if (!payload?.you?.actor)
                throw new Error('Could not join the room');
            remember(payload.you);
            adopt(payload);
            return payload.you;
        },
        /** Read the room without changing anything. */
        async refresh() {
            const query = identity ? `&actor=${encodeURIComponent(identity.actor)}` : '';
            return adopt(await transport.get(`/api/froam/rooms/${roomId}?token=${encodeURIComponent(token)}${query}`));
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
                return adopt(await transport.post(`/api/froam/rooms/${roomId}/presence`, {
                    token,
                    actor: identity.actor,
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
            if (identity)
                params.set('actor', identity.actor);
            const payload = await transport.get(`/api/froam/rooms/${roomId}/comments?${params}`);
            return payload?.comments ?? [];
        },
        async comment(input) {
            if (!identity)
                throw new Error('Join the room first');
            const payload = await transport.post(`/api/froam/rooms/${roomId}/comments`, {
                token, actor: identity.actor, ...input,
            });
            return payload?.comment ?? null;
        },
        /* ─── revisions ─── */
        async revisions(routeKey) {
            const params = new URLSearchParams({ token, routeKey });
            if (identity)
                params.set('actor', identity.actor);
            const payload = await transport.get(`/api/froam/rooms/${roomId}/revisions?${params}`);
            return payload?.revisions ?? [];
        },
        async sendRevision(input) {
            if (!identity)
                throw new Error('Join the room first');
            const payload = await transport.post(`/api/froam/rooms/${roomId}/revisions`, {
                token, actor: identity.actor, ...input,
            });
            return payload?.revision ?? null;
        },
        async decide(revisionId, decision, note) {
            if (!identity)
                throw new Error('Join the room first');
            const payload = await transport.post(`/api/froam/rooms/${roomId}/revisions/${revisionId}/decision`, {
                token, actor: identity.actor, decision, note,
            });
            return payload?.revision ?? null;
        },
        async resolveComment(commentId, resolved = true) {
            if (!identity)
                throw new Error('Join the room first');
            const payload = await transport.post(`/api/froam/rooms/${roomId}/comments/${commentId}/resolve`, {
                token, actor: identity.actor, resolved,
            });
            return payload?.comment ?? null;
        },
    };
}
//# sourceMappingURL=room.js.map