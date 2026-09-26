import { type ChangeEvent } from 'react';
import type { FroamRole } from '../collab/types';
import { type FroamPersona } from './froamPersona';
type Props = {
    open: boolean;
    persona: FroamPersona;
    /** In a room right now: saving updates what everyone there sees. */
    inRoom?: boolean;
    roomRole?: FroamRole | null;
    onChange: (nextPersona: FroamPersona) => void;
    onClose: () => void;
    onSave: () => void;
    onImageUpload: (event: ChangeEvent<HTMLInputElement>) => void;
    /** A photo dropped onto the avatar. */
    onImageFile?: (file: File) => void;
    onClearImage: () => void;
};
/**
 * Your studio profile — and, in a shared room, who you are to everyone else:
 * the face on your cursor, your messages, and every change you send for
 * approval. The previews show exactly that, as you type.
 */
export default function FroamPersonaEditor({ open, persona, inRoom, roomRole, onChange, onClose, onSave, onImageUpload, onImageFile, onClearImage, }: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=FroamPersonaEditor.d.ts.map