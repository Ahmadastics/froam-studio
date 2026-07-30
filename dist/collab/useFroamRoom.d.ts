import { type RoomTransport, type RoomView } from './room';
import type { FroamRole, FroamViewport } from './types';
export type RoomWhere = {
    routeKey?: string;
    viewport?: FroamViewport;
    selectedPath?: string | null;
};
export declare function useFroamRoom(options: {
    /** Where this person currently is, sent on every heartbeat. */
    where: RoomWhere;
    /** Off by default for surfaces that only want to read presence. */
    enabled?: boolean;
    /**
     * Join under this name without asking.
     *
     * The editor is the presenter's side and already knows who they are, so
     * making them type it would be friction for no information. The client side
     * leaves this unset and asks — a name typed once is the only identity a
     * review link has.
     */
    autoJoinAs?: string;
    transport?: RoomTransport;
    everyMs?: number;
    href?: string;
}): {
    /** Is this page a session at all? */
    inRoom: boolean;
    roomId: string | null;
    room: RoomView | null;
    identity: import("./room").RoomIdentity | null;
    /** They have an invite but have not said who they are yet. */
    needsName: boolean;
    joining: boolean;
    error: string | null;
    join: (name: string) => Promise<import("./room").RoomIdentity | null>;
    others: import("./room").RoomMemberView[];
    present: import("./room").RoomMemberView[];
    presenter: import("./room").RoomMemberView | null;
    someoneElseIsPresenting: boolean;
    role: FroamRole | null;
};
//# sourceMappingURL=useFroamRoom.d.ts.map