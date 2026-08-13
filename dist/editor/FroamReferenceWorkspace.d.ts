import { type FroamReferenceUnderstanding } from '../project/reference-intelligence';
import type { FroamProjectDocument } from '../project/types';
import type { FroamReferenceBuildTarget } from '../project/reference-build';
type Props = {
    project: FroamProjectDocument;
    routeKey: string;
    onToast: (message: string) => void;
    onActivityChange?: (activity: 'screenshot' | null) => void;
    selection: {
        nodeId?: string;
        path: string;
        label: string;
    } | null;
    reconstructing?: boolean;
    onReconstruct: (understanding: FroamReferenceUnderstanding, target: FroamReferenceBuildTarget) => void;
    onReferencesChanged?: () => void;
};
export default function FroamReferenceWorkspace(props: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=FroamReferenceWorkspace.d.ts.map