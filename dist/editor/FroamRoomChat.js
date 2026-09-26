import { jsx as _jsx } from "react/jsx-runtime";
import { RoomMessages } from './collaborate/RoomMessages.js';
import { useRoomMessages } from './collaborate/useRoomMessages.js';
/**
 * The room conversation for the client review bar — the same messages the
 * studio's Share → Chat shows, so a client and the team talk in one place.
 */
export default function FroamRoomChat({ client, events, role, roomId, members }) {
    const me = client?.joined ? client.identity?.actor ?? null : null;
    const messaging = useRoomMessages({ client, events, roomId, role, me });
    if (!client?.joined)
        return null;
    return (_jsx(RoomMessages, { messaging: messaging, me: me, person: (actor) => members.find((member) => member.actor === actor), requests: [], active: true, context: null, onClearContext: () => { }, canModerate: role === 'owner' || role === 'editor', joined: true }));
}
//# sourceMappingURL=FroamRoomChat.js.map