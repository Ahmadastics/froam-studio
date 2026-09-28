import type { RoomMemberView } from '../../collab/room';
import type { FroamAnchor } from '../../collab/types';
import type { RoomMessage } from './useRoomMessages';
/**
 * The element a message is pinned to: where its path says, when that is still
 * the same kind of element; otherwise wherever its fingerprint is found.
 */
export declare function findPinned(anchor: {
    path: string;
    nodeId?: string;
    fingerprint: FroamAnchor['fingerprint'];
}, root: HTMLElement): HTMLElement | null;
/**
 * Messages pinned to things on the page, drawn on the things.
 *
 * "Make this shorter" is only useful next to "this". Each pinned element gets
 * one marker — the face of whoever pinned there last, and a count when
 * there's more than one — and clicking it opens the conversation at that
 * message. Only the page and screen size on screen show pins.
 */
export declare function RoomPins({ messages, routeKey, viewport, getRoot, person, onOpen }: {
    messages: readonly RoomMessage[];
    routeKey: string;
    viewport: string;
    getRoot: () => HTMLElement | null;
    person: (actor: string) => RoomMemberView | undefined;
    onOpen: (messageId: string) => void;
}): import("react").JSX.Element | null;
//# sourceMappingURL=RoomPins.d.ts.map