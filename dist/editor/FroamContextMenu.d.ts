type ContextAction = 'edit-with-ai' | 'copy-styles' | 'paste-styles' | 'duplicate' | 'clear' | 'delete-element' | 'bring-to-front' | 'send-to-back' | 'toggle-visibility' | 'wrap-container' | 'upload-image' | 'adjust-image' | 'group-elements' | 'ungroup-elements' | 'customize-ui' | 'archive-component' | 'archive-style' | 'archive-motion' | 'archive-pattern';
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
    /** The element shows a picture that can be cropped and re-fitted. */
    canAdjustImage?: boolean;
    onAction: (action: ContextAction) => void;
    onClose: () => void;
};
export default function FroamContextMenu({ position, elementLabel, isHidden, hasClipboard, hasMultiSelection, isGroup, canAdjustImage, onAction, onClose, }: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=FroamContextMenu.d.ts.map