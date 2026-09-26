import type { RoomMemberView, RoomRequest } from '../../collab/room';
import type { RoomMessaging } from './useRoomMessages';
/**
 * The room's conversation: messages, and what happened to every request, in
 * one place — so "can you make it shorter?" sits right under the change it
 * is about.
 */
export declare function RoomMessages({ messaging, me, myName, person, requests, active, context, onClearContext, onOpenRequest, onOpenPerson, prefill, canModerate, joined, }: {
    messaging: RoomMessaging;
    me: string | null;
    /** Decisions are recorded by name; yours read as "You". */
    myName?: string | null;
    person: (actor: string) => RoomMemberView | undefined;
    requests: readonly RoomRequest[];
    /** The tab is on screen: counts as reading. */
    active: boolean;
    /** The request this message will be about, when replying from a request. */
    context: RoomRequest | null;
    onClearContext: () => void;
    onOpenRequest?: (request: RoomRequest) => void;
    onOpenPerson?: (actor: string) => void;
    /** Text to put in the composer (e.g. "@Maya "), with a nonce so the same text can be sent twice. */
    prefill?: {
        text: string;
        nonce: number;
    } | null;
    canModerate: boolean;
    joined: boolean;
}): import("react").JSX.Element;
//# sourceMappingURL=RoomMessages.d.ts.map