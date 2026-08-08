import type { RoomClient } from '../collab/room';
import type { FroamRole, FroamRoomEvent } from '../collab/types';
type Props = {
    client: RoomClient | null;
    events: readonly FroamRoomEvent[];
    role: FroamRole | null;
};
export default function FroamRoomChat({ client, events, role }: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=FroamRoomChat.d.ts.map