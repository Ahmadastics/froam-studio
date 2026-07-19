type BlueprintCategory = 'heading' | 'media' | 'action' | 'container' | 'text';
export type BlueprintNode = {
    el: HTMLElement;
    x: number;
    y: number;
    w: number;
    h: number;
    category: BlueprintCategory;
    label: string;
};
type Props = {
    open: boolean;
    onClose: () => void;
    routeKey: string;
    getRootEl: () => HTMLElement | null;
    onJumpToElement: (element: HTMLElement) => void;
};
export default function FroamBlueprint({ open, onClose, routeKey, getRootEl, onJumpToElement }: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=FroamBlueprint.d.ts.map