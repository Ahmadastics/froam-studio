type LayerNode = {
    element: HTMLElement;
    path: string;
    tag: string;
    label: string;
    kind: 'element' | 'shape' | 'stamp';
    className: string;
    depth: number;
    hidden: boolean;
    hasChildren: boolean;
    childCount: number;
    nodeId?: string;
};
export type LayerKnowledge = {
    dna: boolean;
    interactions: number;
    responsive?: string;
    archived: boolean;
    graph: boolean;
};
type Props = {
    layers: LayerNode[];
    selectedPath: string | null;
    selections: {
        path: string;
    }[];
    onSelectLayer: (node: LayerNode) => void;
    onToggleVisibility: (node: LayerNode) => void;
    onRefresh: () => void;
    routeKey: string;
    projectName: string;
    branchName: string;
    knowledgeByNodeId: Record<string, LayerKnowledge>;
    onOpenKnowledge: (node: LayerNode, section: 'dna' | 'archive' | 'responsive' | 'interactions-create') => void;
};
export default function FroamLayersPanel({ layers, selectedPath, selections, onSelectLayer, onToggleVisibility, onRefresh, routeKey, projectName, branchName, knowledgeByNodeId, onOpenKnowledge, }: Props): import("react").JSX.Element;
export type { LayerNode };
//# sourceMappingURL=FroamLayersPanel.d.ts.map