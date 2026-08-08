import type { EditorStore, FroamOp, FroamViewport } from '../collab/types';
import type { FroamIdentityDiagnostic, FroamNodeRegistry } from '../project/node-registry';
type SelectionRef = {
    nodeId?: string;
    path: string;
    label: string;
} | null;
type Props = {
    open: boolean;
    onClose: () => void;
    projectId: string;
    actorId: string;
    ops: readonly FroamOp[];
    store: EditorStore;
    registry: FroamNodeRegistry;
    diagnostics: readonly FroamIdentityDiagnostic[];
    routeKey: string;
    viewport: FroamViewport;
    selection: SelectionRef;
    selectedElement: HTMLElement | null;
    onPreviewStore: (store: EditorStore | null) => void;
    onMaterializeBranch: (store: EditorStore) => void;
    onSelectNode: (nodeId: string, path?: string) => void;
    onApplyAnimation: (css: string, inline: string) => void;
    onToast: (message: string) => void;
};
export default function FroamConnectedCanvas(props: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=FroamConnectedCanvas.d.ts.map