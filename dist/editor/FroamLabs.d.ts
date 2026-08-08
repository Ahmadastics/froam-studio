import { type Dispatch, type SetStateAction } from 'react';
import type { FroamProjectDocument } from '../project/types';
type Props = {
    open: boolean;
    onClose: () => void;
    project: FroamProjectDocument;
    onProjectChange: Dispatch<SetStateAction<FroamProjectDocument>>;
    actorId: string;
    selectedNodeId?: string;
    selectedElement: HTMLElement | null;
    onToast: (message: string) => void;
};
export default function FroamLabs(props: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=FroamLabs.d.ts.map