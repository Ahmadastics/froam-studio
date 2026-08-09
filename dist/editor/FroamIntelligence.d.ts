import { type Dispatch, type SetStateAction } from 'react';
import { type FroamScreenshotRegion } from '../project/screenshot-reconstruction';
import type { FroamNodeRegistry } from '../project/node-registry';
import type { FroamProjectDocument } from '../project/types';
type SelectionRef = {
    nodeId?: string;
    path: string;
    label: string;
} | null;
export type FroamIntelligenceTab = 'scan' | 'dna' | 'archive' | 'archaeology' | 'flow' | 'attention' | 'rhythm' | 'responsive' | 'screenshot';
type Props = {
    open: boolean;
    onClose: () => void;
    project: FroamProjectDocument;
    onProjectChange: Dispatch<SetStateAction<FroamProjectDocument>>;
    actorId: string;
    root: HTMLElement | null;
    registry: FroamNodeRegistry;
    onRegistryChange: (registry: FroamNodeRegistry) => void;
    routeKey: string;
    viewport: 'desktop' | 'tablet' | 'mobile';
    selection: SelectionRef;
    selectedElement: HTMLElement | null;
    onSelectNode: (nodeId: string, path?: string) => void;
    onInsertArchived: (html: string) => void;
    onInsertReconstruction: (regions: FroamScreenshotRegion[], width: number, height: number, rootNodeId: string) => HTMLElement;
    onPreviewWidth: (width: number | null) => void;
    onToast: (message: string) => void;
    requestedTab?: FroamIntelligenceTab;
    onTemporalOwnerChange?: (owner: 'breakpoint-cinema' | null) => void;
    onActivityChange?: (activity: 'scanning' | 'screenshot' | null) => void;
};
export default function FroamIntelligence(props: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=FroamIntelligence.d.ts.map