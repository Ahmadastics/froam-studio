import type { RoomMemberView, RoomRequest } from '../../collab/room';
import type { FroamRole } from '../../collab/types';
import type { RoomMessaging } from './useRoomMessages';
export type PendingChange = {
    label: string;
    before: string | null;
    after: string | null;
};
/** What someone tells the room about themselves when they join by link. */
export type JoinProfile = {
    avatarUrl: string | null;
    title: string;
};
type InviteRole = 'editor' | 'contributor' | 'commenter' | 'viewer';
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