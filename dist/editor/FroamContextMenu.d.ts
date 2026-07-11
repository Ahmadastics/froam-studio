type ContextAction = 'copy-styles' | 'paste-styles' | 'duplicate' | 'clear' | 'delete-element' | 'bring-to-front' | 'send-to-back' | 'toggle-visibility' | 'wrap-container' | 'upload-image' | 'group-elements' | 'ungroup-elements';
type Props = {
    position: {
        x: number;
        y: number;
    } | null;
    elementLabel?: string;
    isHidden?: boolean;
    hasClipboard?: boolean;
    hasMultiSelection?: boolean;
    isGroup?: boolean;
    onAction: (action: ContextAction) => void;
    onClose: () => void;
};
export default function FroamContextMenu({ position, elementLabel, isHidden, hasClipboard, hasMultiSelection, isGroup, onAction, onClose, }: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=FroamContextMenu.d.ts.map