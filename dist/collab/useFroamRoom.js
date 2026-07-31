/**
 * Froam Rooms — the room, as a hook.
 *
 * Both sides of a session need the same four things: is there an invite, who
 * am I, who else is here, and who is driving. The presenter gets them inside
 * the editor; the client gets them inside the runtime, which has no editor at
 * all. So this lives apart from both.
 *
 * Inert without an invite in the URL. A page that is not a session does not
 * poll, does not store anything, and does not render anything different.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiGetFresh, apiPost } from '../lib/api.js';
import { createRoomClient, readRoomFromLocation, readOwnedRoom, rememberOwnedRoom, inviteLink, ROOM_BEAT_MS, } from './room.js';
const defaultTransport = {
    get: (path) => apiGetFresh(path),
    post: (path, body) => apiPost(path, body),
};
export function useFroamRoom(options) {
    const { where, enabled = true, transport = defaultTransport, everyMs = ROOM_BEAT_MS, href, autoJoinAs } = options;
    /**
     * Where the room comes from, in order: a link someone was given, then a room
     * this browser opened. The designer made it, so they are in it without
     * pasting their own invite at themselves.
     *
     * Fixed for the life of the page — re-reading it every render would rebuild
     * the client and restart the heartbeat.
     */
    const [ownedTick, setOwnedTick] = useState(0);
    const invite = useMemo(() => {
        const fromLink = readRoomFromLocation(href);
        if (fromLink)
            return fromLink;
        const owned = readOwnedRoom();
        return owned ? { roomId: owned.roomId, token: owned.invites.owner } : null;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [href, ownedTick]);
    const clientRef = useRef(null);
    const builtFor = useRef(null);
    if (invite && builtFor.current !== invite.roomId) {
        builtFor.current = invite.roomId;
        clientRef.current = createRoomClient({ roomId: invite.roomId, token: invite.token, transport });
    }
    const client = clientRef.current;
    // One auto-join per client, survives a StrictMode remount.
    const autoJoinRef = useRef(false);
    const [room, setRoom] = useState(null);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState(null);
    // Heartbeats read this rather than closing over `where`, so a moving
    // selection doesn't tear down and restart the interval every keystroke.
    const whereRef = useRef(where);
    whereRef.current = where;
    useEffect(() => {
        if (!client || !enabled)
            return;
        const off = client.on(setRoom);
        let stop = null;
        const begin = () => { stop = client.start(() => whereRef.current, everyMs); };
        if (client.joined) {
            begin();
        }
        else if (autoJoinAs && !autoJoinRef.current) {
            // Once per client, not once per mount. Both halves of a StrictMode
            // double-mount find no stored identity, so both join, and one person
            // shows up in the room twice — which then reads as "2 here".
            autoJoinRef.current = true;
            void client.join(autoJoinAs).then(begin).catch(() => { autoJoinRef.current = false; });
        }
        else {
            // Nothing to announce until they have a name; still read the room so the
            // surface can say who is already in it.
            void client.refresh().catch(() => { });
        }
        // Coming back to the tab should be instant, not "within one throttled
        // interval". Without this a presenter looks absent for up to a minute
        // after they switch back, which is exactly when they are most present.
        const wake = () => { if (!document.hidden)
            void client.beat(whereRef.current); };
        document.addEventListener('visibilitychange', wake);
        window.addEventListener('focus', wake);
        return () => {
            off();
            stop?.();
            document.removeEventListener('visibilitychange', wake);
            window.removeEventListener('focus', wake);
        };
    }, [client, enabled, everyMs, autoJoinAs]);
    const join = useCallback(async (name) => {
        if (!client)
            return null;
        setJoining(true);
        setError(null);
        try {
            const you = await client.join(name);
            // Announce immediately rather than waiting out the first interval —
            // otherwise the other side sees an empty room for fifteen seconds.
            await client.beat(whereRef.current);
            client.start(() => whereRef.current, everyMs);
            return you;
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not join');
            return null;
        }
        finally {
            setJoining(false);
        }
    }, [client, everyMs]);
    /**
     * Open a room for this project and keep the invites.
     *
     * This is the front door: without it a designer would have to POST to the
     * API by hand to get a link, which is the same as the feature not existing.
     */
    const openRoom = useCallback(async (name) => {
        const payload = await transport.post('/api/froam/rooms', { name });
        if (!payload?.room?.id || !payload.invites)
            throw new Error('Could not open a room');
        const owned = {
            roomId: payload.room.id,
            invites: payload.invites,
            createdAt: Date.now(),
        };
        rememberOwnedRoom(owned);
        // The client is built from `invite`; bumping this rebuilds it against the
        // room that now exists.
        setOwnedTick((n) => n + 1);
        return owned;
    }, [transport]);
    const others = client?.others() ?? [];
    const presenter = client?.presenter() ?? null;
    return {
        /** The raw client, for surfaces that need notes as well as presence. */
        client,
        openRoom,
        owned: readOwnedRoom(),
        inviteLink,
        /** Is this page a session at all? */
        inRoom: Boolean(invite),
        roomId: invite?.roomId ?? null,
        room,
        identity: client?.identity ?? null,
        /** They have an invite but have not said who they are yet. */
        needsName: Boolean(invite) && !(client?.joined ?? false),
        joining,
        error,
        join,
        others,
        present: others.filter((m) => m.here),
        presenter,
        someoneElseIsPresenting: client?.someoneElseIsPresenting() ?? false,
        role: (client?.role() ?? null),
    };
}
//# sourceMappingURL=useFroamRoom.js.map