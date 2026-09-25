import type { RoomMemberView, RoomRequest } from '../../collab/room';
import type { FroamRole } from '../../collab/types';
export type PendingChange = {
    label: string;
    before: string | null;
    after: string | null;
};
type InviteRole = 'editor' | 'contributor' | 'commenter' | 'viewer';
type Props = {
    role: FroamRole | null;
    isOwner: boolean;
    inRoom: boolean;
    myName: string;
    people: readonly RoomMemberView[];
    /** Invite links by role, once a room is open. A role missing here needs fresh links. */
    links: Partial<Record<InviteRole, string>>;
    opening: boolean;
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
    onEditName: () => void;
    /** Arrived by an invite link and hasn't said who they are yet. */
    needsName: boolean;
    onJoin: (name: string) => Promise<void>;
};
/**
 * Share, together, and publishing without a developer.
 *
 * One control in the toolbar: who is here, and what they're waiting on. The
 * owner invites people by what they may do; a contributor edits privately and
 * submits; the owner previews a request on the page, then approves (which
 * publishes it) or sends it back with a note.
 */
export declare function FroamCollaborate(props: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=FroamCollaborate.d.ts.map