import type { RoomClient, RoomMemberView } from '../collab/room';
import type { FroamRole, FroamRoomEvent } from '../collab/types';
type Props = {
    client: RoomClient | null;
    events: readonly FroamRoomEvent[];
    role: FroamRole | null;
    roomId: string | null;
    members: readonly RoomMemberView[];
};
/**
 * The room conversation for the client review bar — the same messages the
 * studio's Share → Chat shows, so a client and the team talk in one place.
 */
export default function FroamRoomChat({ client, events, role, roomId, members }: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=FroamRoomChat.d.ts.map