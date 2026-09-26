import type { RoomClient } from '../../collab/room';
import type { FroamChatMessage, FroamRevertProposal, FroamRole, FroamRoomEvent } from '../../collab/types';
/** A message as the panel shows it: sent, still sending, or failed and retryable. */
export type RoomMessage = FroamChatMessage & {
    state?: 'sending' | 'failed';
};
export type RoomMessaging = {
    messages: readonly RoomMessage[];
    /** Owner only: guests asking to undo someone else's change. */
    proposals: readonly FroamRevertProposal[];
    /** Messages from other people that arrived after you last looked. */
    unread: number;
    /** The newest message from someone else, for the peek under the Share button. */
    latestIncoming: RoomMessage | null;
    send: (body: string, requestId?: string | null) => Promise<boolean>;
    retry: (message: RoomMessage) => Promise<boolean>;
    markRead: () => void;
    decideProposal: (id: string, decision: 'approved' | 'declined') => Promise<void>;
};
/**
 * The room's conversation, kept live from the event stream.
 *
 * Chat events carry the message itself, so a new message costs no request;
 * the full list is read once on joining and again only to heal a gap.
 */
export declare function useRoomMessages({ client, events, roomId, role, me }: {
    client: RoomClient | null;
    events: readonly FroamRoomEvent[];
    roomId: string | null;
    role: FroamRole | null;
    me: string | null;
}): RoomMessaging;
//# sourceMappingURL=useRoomMessages.d.ts.map