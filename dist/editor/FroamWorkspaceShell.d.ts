import type { FroamLabsFlags } from '../project/experiments';
import { type FroamTemporalOwner, type FroamWorkspaceMode, type FroamWorkspaceSection } from './workspace-shell-model';
type Member = {
    actor: string;
    name: string;
    role?: string;
    avatarUrl?: string | null;
};
type Props = {
    mode: FroamWorkspaceMode;
    activeSection: FroamWorkspaceSection;
    onModeChange: (mode: FroamWorkspaceMode) => void;
    onSectionChange: (section: FroamWorkspaceSection) => void;
    projectName: string;
    branchId: string;
    branchName: string;
    members: Member[];
    hasSelection: boolean;
    selectionLabel?: string;
    flags: FroamLabsFlags;
    advancedOpen: boolean;
    onToggleAdvanced: () => void;
    onOpenPrototypes: () => void;
    onOpenReplay: () => void;
    temporalOwner: FroamTemporalOwner;
    activity?: 'scanning' | 'screenshot' | 'mutating' | 'chaos' | 'synthetic' | null;
};
export default function FroamWorkspaceShell(props: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=FroamWorkspaceShell.d.ts.map