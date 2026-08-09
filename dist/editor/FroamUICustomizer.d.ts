import { type FroamUIPreference } from './froamUIPreferences';
type Props = {
    open: boolean;
    value: FroamUIPreference;
    onChange: (value: FroamUIPreference) => void;
    onClose: () => void;
};
export default function FroamUICustomizer({ open, value, onChange, onClose }: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=FroamUICustomizer.d.ts.map