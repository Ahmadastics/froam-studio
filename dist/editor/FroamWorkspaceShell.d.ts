import { MousePointer2 } from 'lucide-react';
import { type FroamTemporalOwner, type FroamWorkspaceMode, type FroamWorkspaceSection } from './workspace-shell-model';
/**
 * Where everything lives. The top bar is one row; each side panel carries its
 * own tabs, the way design tools do: what you build with on the left, how the
 * selection looks on the right.
 */
export type PanelTab = {
    id: FroamWorkspaceSection;
    mode: FroamWorkspaceMode;
    label: string;
    hint: string;
    icon: typeof MousePointer2;
};
export declare const LEFT_PANEL_TABS: PanelTab[];
export declare const RIGHT_PANEL_TABS: PanelTab[];
export declare function FroamPanelTabs({ tabs, active, onSelect, label }: {
    tabs: PanelTab[];
    active: FroamWorkspaceSection | null;
    onSelect: (tab: PanelTab) => void;
    label: string;
}): import("react").JSX.Element;
type Props = {
    mode: FroamWorkspaceMode;
    activeSection: FroamWorkspaceSection;
    branchId: string;
    branchName: string;
    temporalOwner: FroamTemporalOwner;
    activity?: 'scanning' | 'screenshot' | 'mutating' | 'chaos' | 'synthetic' | 'intent-understanding' | 'intent-creating' | 'intent-applying' | null;
    /** Something is selected — the first-time hint has done its job. */
    hasSelection?: boolean;
};
/** What Froam is busy with, and which timeline owns time — shown only while it's true. */
export default function FroamWorkspaceShell(props: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=FroamWorkspaceShell.d.ts.map