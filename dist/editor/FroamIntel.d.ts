import './FroamIntel.css';
type ApplyStyle = (styles: Record<string, string>, nextSel?: never, label?: string) => void;
type Props = {
    selectedElement: HTMLElement | null;
    selectionPath: string;
    applyStyle: ApplyStyle;
    onSelectElement: (el: HTMLElement) => void;
    onFixElement: (el: HTMLElement, styles: Record<string, string>, label: string) => void;
    onToast: (msg: string) => void;
    rootEl: HTMLElement | null;
};
export default function FroamIntel({ selectedElement, selectionPath, applyStyle, onSelectElement, onFixElement, onToast, rootEl }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=FroamIntel.d.ts.map