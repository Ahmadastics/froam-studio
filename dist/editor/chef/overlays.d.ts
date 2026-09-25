import { type ReactNode } from 'react';
export declare function AccordionSection({ id, icon, title, isOpen, onToggle, children, }: {
    id: string;
    icon: ReactNode;
    title: string;
    isOpen: boolean;
    onToggle: () => void;
    children: ReactNode;
}): import("react").JSX.Element;
export declare function Toast({ message, visible }: {
    message: string;
    visible: boolean;
}): import("react").JSX.Element;
export declare const WELCOME_TIPS_KEY = "froam:welcome-tips-dismissed:v1";
export declare function FroamWelcomeTips({ open }: {
    open: boolean;
}): import("react").JSX.Element | null;
export declare const SCAN_DONE_KEY = "froam:scan-done:v1";
export declare const BLUEPRINT_SEEN_KEY = "froam:blueprint-seen:v1";
export type ScanCategory = 'heading' | 'media' | 'action' | 'container' | 'text';
export interface ScanTarget {
    top: number;
    left: number;
    width: number;
    height: number;
    category: ScanCategory;
}
export declare const SCAN_CATEGORY_COLOR: Record<ScanCategory, string>;
export declare function scanCategoryOf(el: Element): ScanCategory | null;
export declare function collectScanTargets(): ScanTarget[];
export declare function FroamScan({ active, onDone }: {
    active: boolean;
    onDone: () => void;
}): import("react").JSX.Element | null;
export declare function MeasurementOverlay({ rect }: {
    rect: DOMRect | null;
}): import("react").JSX.Element | null;
/** Click feedback: a ripple from the exact point clicked and a flash across the element it selected. */
export declare function ClickPulseOverlay({ pulse }: {
    pulse: {
        key: number;
        x: number;
        y: number;
        rect: DOMRect;
    } | null;
}): import("react").JSX.Element | null;
export declare function SelectionHandoffOverlay({ rect, label, mode, count, pulseKey, }: {
    rect: DOMRect | null;
    label: string;
    mode: string;
    count: number;
    pulseKey: number;
}): import("react").JSX.Element | null;
//# sourceMappingURL=overlays.d.ts.map