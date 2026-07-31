/**
 * Froam Rooms — the client half.
 *
 * The server half decides who may do what; this is the part that lives in a
 * page: read the invite out of the URL, become somebody, say you are still
 * here, and know who else is.
 *
 * No ops and no editing yet — that is v5.1. What this establishes is identity
 * and presence, which is what a review session needs before it can decide
 * whether the client follows the designer or just browses the design.
 *
 * Transport and storage are injected so the whole thing can be tested without
 * a browser; the defaults are the ones a page actually wants.
 */
import type { FroamRole, FroamViewport } from './types';
export type RoomMemberView = {
    actor: string;
    name: string;
    role: FroamRole;
    here: boolean;
    routeKey: string | null;
    viewport: FroamViewport | null;
    selectedPath: string | null;
    seenAt: number | null;
};
export type RoomView = {
    id: string;
    routes: readonly string[] | '*';
    createdAt: number;
    members: RoomMemberView[];
    presenter: string | null;
    you: {
        actor: string;
        role: FroamRole;
        name: string;
    } | null;
};
export type RoomIdentity = {
    actor: string;
    name: string;
    role: FroamRole;
};
export type RoomComment = {
    id: string;
    actor: string;
    name: string;
    routeKey: string;
    viewport: FroamViewport;
    anchor: {
        path: string;
        fingerprint: {
            tag: string;
            text?: string;
            id?: string;
        };
    };
    quoted: string | null;
    body: string;
    createdAt: number;
    resolved: boolean;
    resolvedBy?: string | null;
    replies: Array<{
        id: string;
        actor: string;
        name: string;
        body: string;
        createdAt: number;
    }>;
};
export type RoomRevision = {
    id: string;
    routeKey: string;
    viewport: FroamViewport;
    store: Record<string, unknown>;
    note: string | null;
    createdAt: number;
    createdBy: string;
    status: 'sent' | 'approved' | 'changes-requested';
    decidedBy: string | null;
    decidedAt: number | null;
    decisionNote: string | null;
};
export type RoomTransport = {
    get: (path: string) => Promise<unknown>;
    post: (path: string, body: unknown) => Promise<unknown>;
};
export type RoomStorage = {
    read: (key: string) => string | null;
    write: (key: string, value: string) => void;
};
/** Heartbeat well inside the server's 45s window, so one dropped beat is survivable. */
export declare const ROOM_BEAT_MS = 15000;
export declare const ROOM_PARAM = "froam-room";
export declare const TOKEN_PARAM = "froam-token";
/**
 * An invite is a link, so the link is where the room comes from.
 *
 * The token is a bearer credential sitting in a URL — which is the deliberate
 * trade that makes "tap this and you're in" possible at all. It is scoped to
 * one room and revocable by deleting it, and it is why nothing sensitive
 * beyond that design should ever live behind one.
 */
export declare function readRoomFromLocation(href?: string): {
    roomId: string;
    token: string;
} | null;
export type OwnedRoom = {
    roomId: string;
    /** One token per role. The commenter one is what you send a client. */
    invites: Record<FroamRole, string>;
    createdAt: number;
};
/**
 * The designer should not have to paste their own invite into their own
 * browser. They made the room, so the browser remembers it and they are simply
 * in it — the link exists to be given away, not to be kept.
 */
export declare function readOwnedRoom(): OwnedRoom | null;
export declare function rememberOwnedRoom(room: OwnedRoom): void;
export declare function forgetOwnedRoom(): void;
/** The link you actually send someone, for a given role and page. */
export declare function inviteLink(room: OwnedRoom, role?: FroamRole, href?: string): string;
export declare function createRoomClient(options: {
    roomId: string;
    token: string;
    transport: RoomTransport;
    storage?: RoomStorage;
    /** Defaults to document.hidden — a background tab should stop counting as present. */
    isHidden?: () => boolean;
    now?: () => number;
}): {
    readonly roomId: string;
    readonly identity: RoomIdentity | null;
    readonly room: RoomView | null;
    /** Have we already been someone in this room? Decides whether to ask for a name. */
    readonly joined: boolean;
    on(listener: (room: RoomView | null) => void): () => boolean;
    /**
     * Become somebody. Reuses the actor from a previous visit when there is
     * one, so a refresh keeps your comments yours instead of minting a
     * stranger who happens to have the same name.
     */
    join(name: string): Promise<RoomIdentity>;
    /** Read the room without changing anything. */
    refresh(): Promise<RoomView | null>;
    /**
     * Say you are still here, and where.
     *
     * Skipped while the tab is hidden — presence should mean "someone is
     * looking", and a heartbeat from a buried tab would keep a phone following
     * a laptop nobody is sitting at.
     */
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
    /** Everyone but you. */
    others(): RoomMemberView[];
    /** Everyone but you, who is actually here. */
    present(): RoomMemberView[];
    presenter(): RoomMemberView | null;
    /** Is someone else driving? The question v5.1's follow mode turns on. */
    someoneElseIsPresenting(): boolean;
    role(): FroamRole | null;
    comments(routeKey: string): Promise<RoomComment[]>;
    comment(input: {
        routeKey: string;
        viewport: FroamViewport;
        anchor: {
            path: string;
            fingerprint: unknown;
        };
        quoted?: string | null;
        body: string;
    }): Promise<RoomComment | null>;
    revisions(routeKey: string): Promise<RoomRevision[]>;
    sendRevision(input: {
        routeKey: string;
        viewport: FroamViewport;
        store: unknown;
        note?: string;
    }): Promise<RoomRevision | null>;
    decide(revisionId: string, decision: "approved" | "changes-requested", note?: string): Promise<RoomRevision | null>;
    resolveComment(commentId: string, resolved?: boolean): Promise<RoomComment | null>;
};
export type RoomClient = ReturnType<typeof createRoomClient>;
//# sourceMappingURL=room.d.ts.map