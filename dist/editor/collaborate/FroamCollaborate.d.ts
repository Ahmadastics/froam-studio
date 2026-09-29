import { type RoomMemberView, type RoomRequest } from '../../collab/room';
import type { FroamMessageAnchor, FroamRole, FroamViewport } from '../../collab/types';
import type { RequestCheck } from './request-checks';
import type { RoomMessaging } from './useRoomMessages';
export type PendingChange = {
    label: string;
    before: string | null;
    after: string | null;
    routeKey?: string;
    viewport?: FroamViewport;
};
/** "Home", "/pricing (mobile)" — a page and screen size, as a person says it. */
export declare function whereLabel(routeKey?: string, viewport?: string): string;
/** What someone tells the room about themselves when they join by link. */
export type JoinProfile = {
    avatarUrl: string | null;
    title: string;
};
type InviteRole = 'editor' | 'contributor' | 'commenter' | 'viewer';
/**
 * A site on this computer and the public link that makes its invites open
 * anywhere. `on`: wanted; `ready`: its address is known; `online`: the tunnel
 * is up right now.
 */
export type Reach = {
    local: true;
    available: boolean;
    on: boolean;
    ready: boolean;
    online: boolean;
    url: string | null;
    starting: boolean;
    error: string | null;
    expiresAt?: number | null;
};
type Props = {
    role: FroamRole | null;
    isOwner: boolean;
    inRoom: boolean;
    /** Has this browser joined the room (so it can talk)? */
    joined: boolean;
    myName: string;
    /** You, as the room sees you: your profile photo, colour and title. */
    me: RoomMemberView | null;
    people: readonly RoomMemberView[];
    /** Invite links by role, once a room is open. A role missing here needs fresh links. */
    links: Partial<Record<InviteRole, string>>;
    opening: boolean;
    /** Invite links couldn't be made: nothing is serving rooms for this page. */
    shareUnavailable?: boolean;
    onOpenRoom: (fresh: boolean) => void;
    onCopyLink: (link: string, role: InviteRole) => void;
    requests: readonly RoomRequest[];
    /** Contributor: what they've changed since they joined. */
    pendingChanges: readonly PendingChange[];
    onSubmit: (title: string, note: string) => Promise<boolean>;
    onWithdraw: (request: RoomRequest) => void;
    /** Owner: show a request on the page without applying it. */
    previewingId: string | null;
    onPreview: (request: RoomRequest | null) => void;
    onDecide: (request: RoomRequest, decision: 'approved' | 'changes-requested', note: string) => Promise<void>;
    messaging: RoomMessaging;
    onEditProfile: () => void;
    /** Arrived by an invite link and hasn't said who they are yet. */
    needsName: boolean;
    /** Prefills the join card from a studio profile this browser already has. */
    knownProfile?: {
        name: string;
        avatarUrl: string | null;
        title: string;
    } | null;
    onJoin: (name: string, profile: JoinProfile) => Promise<void>;
    /** Owner: take an approved change back. Absent where the room can't revert. */
    onRevert?: (request: RoomRequest, note: string) => Promise<void>;
    /** What the checks found on the request being previewed. */
    checks?: {
        requestId: string;
        items: readonly RequestCheck[];
    } | null;
    /** When the room ends (the public demo keeps rooms for a week). */
    expiresAt?: number | null;
    /** Open the panel on this — from a notification link or a pin on the page. */
    openTarget?: {
        kind: 'request' | 'message';
        id: string;
        nonce: number;
    } | null;
    /** The panel is open on the target; the editor can stop holding it. */
    onOpenedTarget?: () => void;
    /** The element selected on the page, for pinning a message to it. */
    pinTarget?: FroamMessageAnchor | null;
    /** Show a pinned message's element on the page. */
    onShowAnchor?: (anchor: FroamMessageAnchor) => void;
    /** Typing a message (shown to others as "… is typing"). */
    onTyping?: (typing: boolean) => void;
    /** Owner: done collaborating — every link stops working, everyone is told. */
    onEndRoom?: () => Promise<void>;
    /** The owner ended this session (for everyone else who was in it). */
    ended?: {
        at: number;
        by: string | null;
    } | null;
    /** A site on this computer: its public link through the share service. */
    reach?: Reach | null;
    /** The public link is on its way: there are no links to copy yet. */
    linksPending?: boolean;
    onReach?: (on: boolean) => void;
    /** How long the public link works: 24 hours, 7 days, or until it's turned off. */
    onShareExpiry?: (expiresIn: '24h' | '7d' | 'off') => void;
};
/**
 * Share, talk, and publishing without a developer — everything about working
 * with other people, in one control in the toolbar.
 *
 * The owner invites people by what they may do; everyone in the room talks in
 * Chat; a contributor edits privately and submits; the owner previews a
 * request on the page, then approves (which publishes it) or sends it back.
 * Every request and message carries the sender's profile.
 */
export declare function FroamCollaborate(props: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=FroamCollaborate.d.ts.map