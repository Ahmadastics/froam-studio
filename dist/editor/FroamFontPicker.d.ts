import { type FontOption } from './fontSources';
type Props = {
    value: string;
    options: readonly FontOption[];
    onPick: (value: string) => void;
    /** 'bar' is the compact floating-toolbar trigger; 'panel' fills a Design panel row. */
    variant?: 'bar' | 'panel';
    className?: string;
};
export default function FroamFontPicker({ value, options, onPick, variant, className }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=FroamFontPicker.d.ts.map