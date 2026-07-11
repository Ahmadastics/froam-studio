import type { ChangeEvent } from 'react';
import { type FroamPersona } from './froamPersona';
type Props = {
    open: boolean;
    persona: FroamPersona;
    onChange: (nextPersona: FroamPersona) => void;
    onClose: () => void;
    onSave: () => void;
    onImageUpload: (event: ChangeEvent<HTMLInputElement>) => void;
    onClearImage: () => void;
};
export default function FroamPersonaEditor({ open, persona, onChange, onClose, onSave, onImageUpload, onClearImage, }: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=FroamPersonaEditor.d.ts.map