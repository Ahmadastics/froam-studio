export const DEVICE_SIZES = {
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
};
export const DEFAULT_DEVICE_SIZES = { mobile: 'phone', tablet: 'tablet' };
const KEY = 'froam-device-size-v1';
export function readDeviceSizes() {
    try {
        const saved = JSON.parse(window.localStorage.getItem(KEY) ?? 'null');
        return {
            mobile: DEVICE_SIZES.mobile.some((s) => s.id === saved?.mobile) ? saved.mobile : DEFAULT_DEVICE_SIZES.mobile,
            tablet: DEVICE_SIZES.tablet.some((s) => s.id === saved?.tablet) ? saved.tablet : DEFAULT_DEVICE_SIZES.tablet,
        };
    }
    catch {
        return { ...DEFAULT_DEVICE_SIZES };
    }
}
export function writeDeviceSizes(sizes) {
    try {
        window.localStorage.setItem(KEY, JSON.stringify(sizes));
    }
    catch { /* this session only */ }
}
export function deviceSizeFor(kind, id) {
    return DEVICE_SIZES[kind].find((size) => size.id === id) ?? DEVICE_SIZES[kind].find((size) => size.id === DEFAULT_DEVICE_SIZES[kind]);
}
//# sourceMappingURL=device-sizes.js.map