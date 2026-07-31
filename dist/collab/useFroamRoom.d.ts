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
    /** The raw client, for surfaces that need notes as well as presence. */
    client: {
        readonly roomId: string;
        readonly identity: import("./room").RoomIdentity | null;
        readonly room: RoomView | null;
        readonly joined: boolean;
        on(listener: (room: RoomView | null) => void): () => boolean;
        join(name: string): Promise<import("./room").RoomIdentity>;
        refresh(): Promise<RoomView | null>;
        beat(where?: {
            routeKey?: string;
            viewport?: FroamViewport;
            selectedPath?: string | null;
        }): Promise<RoomView | null>;
        start(where: () => {
            routeKey?: string;
            viewport?: FroamViewport;
            selectedPath?: string | null;
        }, everyMs?: number): () => void;
        stop(): void;
        others(): import("./room").RoomMemberView[];
        present(): import("./room").RoomMemberView[];
        presenter(): import("./room").RoomMemberView | null;
        someoneElseIsPresenting(): boolean;
        role(): FroamRole | null;
        comments(routeKey: string): Promise<import("./room").RoomComment[]>;
        comment(input: {
            routeKey: string;
            viewport: FroamViewport;
            anchor: {
                path: string;
                fingerprint: unknown;
            };
            quoted?: string | null;
            body: string;
        }): Promise<import("./room").RoomComment | null>;
        revisions(routeKey: string): Promise<import("./room").RoomRevision[]>;
        sendRevision(input: {
            routeKey: string;
            viewport: FroamViewport;
            store: unknown;
            note?: string;
        }): Promise<import("./room").RoomRevision | null>;
        decide(revisionId: string, decision: "approved" | "changes-requested", note?: string): Promise<import("./room").RoomRevision | null>;
        resolveComment(commentId: string, resolved?: boolean): Promise<import("./room").RoomComment | null>;
    } | null;
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