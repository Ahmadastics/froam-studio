import type { FroamProjectDocument } from '../project/types';
type Props = {
    project: FroamProjectDocument;
    routeKey: string;
    onToast: (message: string) => void;
    onActivityChange?: (activity: 'screenshot' | null) => void;
};
export default function FroamReferenceWorkspace(props: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=FroamReferenceWorkspace.d.ts.map