import { type PseudoElement } from './pseudo';
type Props = {
    element: HTMLElement | null;
    styles: Record<string, string> | undefined;
    onChange: (pseudo: PseudoElement, styles: Record<string, string>, label: string) => void;
};
/**
 * ::before / ::after of the selection: what the page already draws there, and
 * fields to change it — or to add one to an element that has none.
 */
export declare function PseudoElementsSection({ element, styles, onChange }: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=PseudoElementsSection.d.ts.map