/**
 * The screens a preview can be. Every size sits inside the range its edits
 * are saved for (lib/codegen.mjs: phone up to 640px wide, tablet 641–1024px),
 * so what you see in the preview is what those edits do on a real device —
 * which is also why there's no landscape phone: at 844px wide it's a tablet.
 */
export type DeviceKind = 'mobile' | 'tablet'
export type DeviceSize = { id: string; label: string; width: number; height: number; island?: boolean }

export const DEVICE_SIZES: Record<DeviceKind, DeviceSize[]> = {
  mobile: [
    { id: 'phone-small', label: 'Small phone', width: 375, height: 667 },
    { id: 'phone', label: 'Phone', width: 390, height: 844, island: true },
    { id: 'phone-large', label: 'Large phone', width: 430, height: 932, island: true },
  ],
  tablet: [
    { id: 'tablet', label: 'Tablet', width: 768, height: 1024 },
    { id: 'tablet-large', label: 'Large tablet', width: 820, height: 1180 },
    { id: 'tablet-landscape', label: 'Tablet, landscape', width: 1024, height: 768 },
  ],
}

export const DEFAULT_DEVICE_SIZES: Record<DeviceKind, string> = { mobile: 'phone', tablet: 'tablet' }
const KEY = 'froam-device-size-v1'

export function readDeviceSizes(): Record<DeviceKind, string> {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as Partial<Record<DeviceKind, string>> | null
    return {
      mobile: DEVICE_SIZES.mobile.some((s) => s.id === saved?.mobile) ? saved!.mobile! : DEFAULT_DEVICE_SIZES.mobile,
      tablet: DEVICE_SIZES.tablet.some((s) => s.id === saved?.tablet) ? saved!.tablet! : DEFAULT_DEVICE_SIZES.tablet,
    }
  } catch { return { ...DEFAULT_DEVICE_SIZES } }
}

export function writeDeviceSizes(sizes: Record<DeviceKind, string>) {
  try { window.localStorage.setItem(KEY, JSON.stringify(sizes)) } catch { /* this session only */ }
}

export function deviceSizeFor(kind: DeviceKind, id: string | undefined) {
  return DEVICE_SIZES[kind].find((size) => size.id === id) ?? DEVICE_SIZES[kind].find((size) => size.id === DEFAULT_DEVICE_SIZES[kind])!
}

/** Where a preview frame sits on screen, for the bar beneath it. */
export type DeviceFrame = { kind: DeviceKind; size: DeviceSize; scale: number; left: number; top: number; width: number; height: number }
