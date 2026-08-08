import type { RoomMemberView } from '../collab/room';
import type { FroamViewport } from '../collab/types';
type Props = {
    members: readonly RoomMemberView[];
    routeKey: string;
    viewport: FroamViewport;
    root: HTMLElement | null;
};
/** Ephemeral multiplayer chrome. Nothing rendered here is persisted. */
export default function FroamPresenceLayer({ members, routeKey, viewport, root }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=FroamPresenceLayer.d.ts.map