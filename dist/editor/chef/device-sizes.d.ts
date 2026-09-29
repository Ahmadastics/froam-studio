/**
 * The screens a preview can be. Every size sits inside the range its edits
 * are saved for (lib/codegen.mjs: phone up to 640px wide, tablet 641–1024px),
 * so what you see in the preview is what those edits do on a real device —
 * which is also why there's no landscape phone: at 844px wide it's a tablet.
 */
export type DeviceKind = 'mobile' | 'tablet';
export type DeviceSize = {
    id: string;
    label: string;
    width: number;
    height: number;
    island?: boolean;
};
export declare const DEVICE_SIZES: Record<DeviceKind, DeviceSize[]>;
export declare const DEFAULT_DEVICE_SIZES: Record<DeviceKind, string>;
export declare function readDeviceSizes(): Record<DeviceKind, string>;
export declare function writeDeviceSizes(sizes: Record<DeviceKind, string>): void;
export declare function deviceSizeFor(kind: DeviceKind, id: string | undefined): DeviceSize;
/** Where a preview frame sits on screen, for the bar beneath it. */
export type DeviceFrame = {
    kind: DeviceKind;
    size: DeviceSize;
    scale: number;
    left: number;
    top: number;
    width: number;
    height: number;
};
//# sourceMappingURL=device-sizes.d.ts.map