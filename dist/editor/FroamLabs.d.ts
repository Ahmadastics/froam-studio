import { type Dispatch, type SetStateAction } from 'react';
import { type FroamLabsFlags } from '../project/experiments';
import type { FroamProjectDocument } from '../project/types';
export type FroamLab = 'mutate' | 'interactions' | 'sample' | 'physics' | 'break' | 'user' | 'sound' | 'trailer' | 'reality';
type Props = {
    open: boolean;
    onClose: () => void;
    project: FroamProjectDocument;
    onProjectChange: Dispatch<SetStateAction<FroamProjectDocument>>;
    actorId: string;
    selectedNodeId?: string;
    selectedElement: HTMLElement | null;
    onToast: (message: string) => void;
    requestedLab?: FroamLab;
    flags?: FroamLabsFlags;
    onFlagsChange?: (flags: FroamLabsFlags) => void;
    onTemporalOwnerChange?: (owner: 'sampling' | 'trailer' | null) => void;
    onActivityChange?: (activity: 'mutating' | 'chaos' | 'synthetic' | null) => void;
};
export default function FroamLabs(props: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=FroamLabs.d.ts.map