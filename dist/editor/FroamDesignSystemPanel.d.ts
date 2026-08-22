import type { FroamDesignSystem, FroamStyleState } from '../project/types';
export default function FroamDesignSystemPanel({ system, onChange, onApplyStyle, onToast }: {
    system: FroamDesignSystem;
    onChange: (system: FroamDesignSystem, label: string) => void;
    onApplyStyle: (states: Partial<Record<FroamStyleState, Record<string, string>>>, name: string) => void;
    onToast: (message: string) => void;
}): import("react").JSX.Element;
//# sourceMappingURL=FroamDesignSystemPanel.d.ts.map