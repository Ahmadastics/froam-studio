export const FROAM_FRAME_PRESETS = {
    responsive: { preset: 'responsive', width: 1200, height: 720, background: '#ffffff' },
    desktop: { preset: 'desktop', width: 1440, height: 900, background: '#ffffff' },
    tablet: { preset: 'tablet', width: 768, height: 1024, background: '#ffffff' },
    mobile: { preset: 'mobile', width: 390, height: 844, background: '#ffffff' },
};
export function createFroamSection(componentId, name, frame = FROAM_FRAME_PRESETS.responsive) {
    return {
        id: `section-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        componentId,
        name,
        frame: { ...frame },
    };
}
//# sourceMappingURL=FroamPlannerTypes.js.map