import { type ReactNode } from 'react';
export type SheetDetent = 'peek' | 'half' | 'full';
type Props = {
    detent: SheetDetent;
    onDetentChange: (detent: SheetDetent) => void;
    title: string;
    subtitle?: string;
    children: ReactNode;
};
export default function FroamBottomSheet({ detent, onDetentChange, title, subtitle, children }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=FroamBottomSheet.d.ts.map