import { type FroamFrameSpec, type FroamInsertPlacement, type FroamWireframeSection } from './FroamPlannerTypes';
export type PlannerTab = 'blueprint' | 'sitemap' | 'wireframe' | 'library';
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
    requestedTab?: PlannerTab;
    selection: {
        nodeId?: string;
        label: string;
    } | null;
    archiveItems: Array<{
        id: string;
        name: string;
        html?: string;
    }>;
    assets?: Array<{
        id: string;
        name: string;
        url: string;
    }>;
    onRenameProject?: (name: string) => void;
    onAddAsset?: (url: string, name: string) => void;
    onApplyAsset?: (url: string) => void;
    onRemoveAsset?: (id: string) => void;
    onTabChange?: (tab: PlannerTab) => void;
    onInsertComponent: (componentId: string, placement: FroamInsertPlacement, frame: FroamFrameSpec) => void;
    onInsertBlankFrame: (placement: FroamInsertPlacement, frame: FroamFrameSpec) => void;
    onInsertBlock: (kind: 'section' | 'container' | 'grid' | 'text' | 'image' | 'button', placement: 'inside' | 'after') => void;
    onInsertArchived: (html: string, placement: FroamInsertPlacement) => void;
    onBuildPage: (sections: FroamWireframeSection[]) => void;
    onPlanChange: (pages: SitePage[]) => void;
    onToast: (message: string) => void;
};
export default function FroamSitePlanner({ routeKey, projectName, branchName, requestedTab, selection, archiveItems, assets, onRenameProject, onAddAsset, onApplyAsset, onRemoveAsset, onTabChange, onInsertComponent, onInsertBlankFrame, onInsertBlock, onInsertArchived, onBuildPage, onPlanChange, onToast }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=FroamSitePlanner.d.ts.map