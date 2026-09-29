type Props = {
    open: boolean;
    selectionLabel?: string;
    busy?: boolean;
    onSubmit: (intent: string) => void;
    onClose: () => void;
    /** null: this editor can't reach an AI at all (no bridge, or not the owner). */
    ai?: {
        available: boolean;
        on: boolean;
        model: string | null;
        onToggle: () => void;
    } | null;
};
export default function FroamQuickChat({ open, selectionLabel, busy, onSubmit, onClose, ai }: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=FroamQuickChat.d.ts.map