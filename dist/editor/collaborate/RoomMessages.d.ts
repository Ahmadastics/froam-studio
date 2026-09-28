import type { RoomMemberView, RoomRequest } from '../../collab/room';
import type { FroamMessageAnchor } from '../../collab/types';
import type { RoomMessaging } from './useRoomMessages';
/** The presence label a person shows while writing a message. */
export declare const TYPING = "Typing a message";
/**
 * The room's conversation: messages, and what happened to every request, in
 * one place — so "can you make it shorter?" sits right under the change it
 * is about.
 */
export declare function RoomMessages({ messaging, me, myName, person, requests, active, context, onClearContext, onOpenRequest, onOpenPerson, prefill, canModerate, joined, people, pinTarget, onShowAnchor, onTyping, focusMessageId, }: {
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
    /** Everyone else in the room: who can be @mentioned, and who is typing. */
    people?: readonly RoomMemberView[];
    /** The element selected on the page, which a message can be pinned to. */
    pinTarget?: FroamMessageAnchor | null;
    onShowAnchor?: (anchor: FroamMessageAnchor) => void;
    onTyping?: (typing: boolean) => void;
    /** Scroll to and highlight this message (a notification or a pin pointed at it). */
    focusMessageId?: string | null;
}): import("react").JSX.Element;
//# sourceMappingURL=RoomMessages.d.ts.map