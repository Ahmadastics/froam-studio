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
import { createRoomClient, readRoomFromLocation, ROOM_BEAT_MS, } from './room.js';
const defaultTransport = {
    get: (path) => apiGetFresh(path),
    post: (path, body) => apiPost(path, body),
};
export function useFroamRoom(options) {
    const { where, enabled = true, transport = defaultTransport, everyMs = ROOM_BEAT_MS, href, autoJoinAs } = options;
    // The invite is fixed for the life of the page; re-reading it on every
    // render would rebuild the client and restart the heartbeat.
    const invite = useMemo(() => readRoomFromLocation(href), [href]);
    const clientRef = useRef(null);
    if (invite && !clientRef.current) {
        clientRef.current = createRoomClient({ roomId: invite.roomId, token: invite.token, transport });
    }
    const client = clientRef.current;
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
        else if (autoJoinAs) {
            void client.join(autoJoinAs).then(begin).catch(() => { });
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
    const others = client?.others() ?? [];
    const presenter = client?.presenter() ?? null;
    return {
        /** The raw client, for surfaces that need notes as well as presence. */
        client,
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