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
};
export default function FroamLayersPanel({ layers, selectedPath, selections, onSelectLayer, onToggleVisibility, onRefresh, routeKey, }: Props): import("react").JSX.Element;
export type { LayerNode };
//# sourceMappingURL=FroamLayersPanel.d.ts.map