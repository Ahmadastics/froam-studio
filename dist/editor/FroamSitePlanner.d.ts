import { type FroamFrameSpec, type FroamInsertPlacement, type FroamWireframeSection } from './FroamPlannerTypes';
type SitePage = {
    id: string;
    name: string;
    path: string;
    parentId: string | null;
    status: 'draft' | 'ready';
    sections: FroamWireframeSection[];
};
type Props = {
    routeKey: string;
    projectName: string;
    branchName: string;
    selection: {
        nodeId?: string;
        label: string;
    } | null;
    archiveItems: Array<{
        id: string;
        name: string;
        html?: string;
    }>;
    onInsertComponent: (componentId: string, placement: FroamInsertPlacement, frame: FroamFrameSpec) => void;
    onInsertBlankFrame: (placement: FroamInsertPlacement, frame: FroamFrameSpec) => void;
    onInsertBlock: (kind: 'section' | 'container' | 'grid' | 'text' | 'image' | 'button', placement: 'inside' | 'after') => void;
    onInsertArchived: (html: string, placement: FroamInsertPlacement) => void;
    onBuildPage: (sections: FroamWireframeSection[]) => void;
    onPlanChange: (pages: SitePage[]) => void;
    onToast: (message: string) => void;
};
export default function FroamSitePlanner({ routeKey, projectName, branchName, selection, archiveItems, onInsertComponent, onInsertBlankFrame, onInsertBlock, onInsertArchived, onBuildPage, onPlanChange, onToast }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=FroamSitePlanner.d.ts.map