import type { FroamIntentState } from './froam-intent-model';
type Props = {
    state: FroamIntentState;
    onAllow: () => void;
    onNotNow: () => void;
    onKeep: () => void;
    onRetry: () => void;
    onCancel: () => void;
    onDismiss: () => void;
};
export default function FroamIntentResult(props: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=FroamIntentResult.d.ts.map