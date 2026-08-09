const frame = (transform, opacity) => ({ transform, ...(opacity === undefined ? {} : { opacity }) });
const two = (from, to) => [
    { id: 'from', offset: 0, properties: from }, { id: 'to', offset: 100, properties: to },
];
export const FROAM_ANIMATION_PRESETS = [
    { id: 'fade-up-soft', label: 'Soft rise', category: 'Entrance', description: 'Calm product entrance', config: { name: 'froam-soft-rise', duration: 650, easing: 'cubic-bezier(.22,1,.36,1)', keyframes: two(frame('translateY(18px)', '0'), frame('translateY(0)', '1')) } },
    { id: 'fade-down', label: 'Drop in', category: 'Entrance', description: 'Arrive from above', config: { name: 'froam-drop-in', duration: 520, keyframes: two(frame('translateY(-28px)', '0'), frame('translateY(0)', '1')) } },
    { id: 'slide-left', label: 'Glide left', category: 'Entrance', description: 'Enter from the right', config: { name: 'froam-glide-left', duration: 560, keyframes: two(frame('translateX(44px)', '0'), frame('translateX(0)', '1')) } },
    { id: 'slide-right', label: 'Glide right', category: 'Entrance', description: 'Enter from the left', config: { name: 'froam-glide-right', duration: 560, keyframes: two(frame('translateX(-44px)', '0'), frame('translateX(0)', '1')) } },
    { id: 'pop', label: 'Pop', category: 'Entrance', description: 'Fast confident scale', config: { name: 'froam-pop', duration: 360, easing: 'cubic-bezier(.34,1.56,.64,1)', keyframes: two(frame('scale(.72)', '0'), frame('scale(1)', '1')) } },
    { id: 'flip-card', label: 'Flip card', category: 'Entrance', description: 'Dimensional card arrival', config: { name: 'froam-flip-card', duration: 680, easing: 'cubic-bezier(.22,1,.36,1)', keyframes: two(frame('perspective(900px) rotateX(-18deg) translateY(18px)', '0'), frame('perspective(900px) rotateX(0) translateY(0)', '1')) } },
    { id: 'blur-in', label: 'Focus in', category: 'Reveal', description: 'Blur resolves into clarity', config: { name: 'froam-focus-in', duration: 700, keyframes: two({ filter: 'blur(16px)', opacity: '0' }, { filter: 'blur(0)', opacity: '1' }) } },
    { id: 'wipe-right', label: 'Wipe right', category: 'Reveal', description: 'Reveal across the surface', config: { name: 'froam-wipe-right', duration: 720, easing: 'cubic-bezier(.65,0,.35,1)', keyframes: two({ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }) } },
    { id: 'wipe-up', label: 'Wipe up', category: 'Reveal', description: 'Reveal from the baseline', config: { name: 'froam-wipe-up', duration: 650, keyframes: two({ clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0 0 0 0)' }) } },
    { id: 'unfold', label: 'Unfold', category: 'Reveal', description: 'Open from the top edge', config: { name: 'froam-unfold', duration: 620, easing: 'cubic-bezier(.22,1,.36,1)', keyframes: two(frame('scaleY(.08)', '0'), frame('scaleY(1)', '1')) } },
    { id: 'text-focus', label: 'Text focus', category: 'Reveal', description: 'Editorial letter reveal', config: { name: 'froam-text-focus', duration: 800, keyframes: [{ id: 'a', offset: 0, properties: { filter: 'blur(10px)', opacity: '0', transform: 'translateY(8px)' } }, { id: 'b', offset: 60, properties: { filter: 'blur(2px)', opacity: '.75' } }, { id: 'c', offset: 100, properties: { filter: 'blur(0)', opacity: '1', transform: 'translateY(0)' } }] } },
    { id: 'shine', label: 'Shine', category: 'Emphasis', description: 'Brief luminous emphasis', config: { name: 'froam-shine', duration: 900, keyframes: [{ id: 'a', offset: 0, properties: { filter: 'brightness(1)' } }, { id: 'b', offset: 45, properties: { filter: 'brightness(1.55)', boxShadow: '0 0 30px rgba(94,234,212,.35)' } }, { id: 'c', offset: 100, properties: { filter: 'brightness(1)', boxShadow: 'none' } }] } },
    { id: 'heartbeat', label: 'Heartbeat', category: 'Emphasis', description: 'Double pulse for attention', config: { name: 'froam-heartbeat', duration: 900, keyframes: [{ id: 'a', offset: 0, properties: frame('scale(1)') }, { id: 'b', offset: 18, properties: frame('scale(1.08)') }, { id: 'c', offset: 34, properties: frame('scale(1)') }, { id: 'd', offset: 52, properties: frame('scale(1.05)') }, { id: 'e', offset: 100, properties: frame('scale(1)') }] } },
    { id: 'jelly', label: 'Jelly', category: 'Emphasis', description: 'Playful elastic response', config: { name: 'froam-jelly', duration: 720, keyframes: [{ id: 'a', offset: 0, properties: frame('scale3d(1,1,1)') }, { id: 'b', offset: 30, properties: frame('scale3d(1.18,.82,1)') }, { id: 'c', offset: 45, properties: frame('scale3d(.88,1.12,1)') }, { id: 'd', offset: 65, properties: frame('scale3d(1.06,.94,1)') }, { id: 'e', offset: 100, properties: frame('scale3d(1,1,1)') }] } },
    { id: 'tilt', label: 'Tilt', category: 'Emphasis', description: 'Subtle tactile acknowledgement', config: { name: 'froam-tilt', duration: 480, keyframes: [{ id: 'a', offset: 0, properties: frame('rotate(0)') }, { id: 'b', offset: 35, properties: frame('rotate(-3deg) scale(1.02)') }, { id: 'c', offset: 70, properties: frame('rotate(2deg)') }, { id: 'd', offset: 100, properties: frame('rotate(0)') }] } },
    { id: 'button-press', label: 'Button press', category: 'Emphasis', description: 'Tactile click feedback', config: { name: 'froam-button-press', duration: 260, trigger: 'click', keyframes: [{ id: 'a', offset: 0, properties: frame('scale(1)') }, { id: 'b', offset: 45, properties: frame('scale(.94)') }, { id: 'c', offset: 100, properties: frame('scale(1)') }] } },
    { id: 'hover-lift', label: 'Hover lift', category: 'Emphasis', description: 'Card hover with depth', config: { name: 'froam-hover-lift', duration: 320, trigger: 'hover', fillMode: 'forwards', keyframes: two({ transform: 'translateY(0)', boxShadow: '0 4px 14px rgba(0,0,0,.12)' }, { transform: 'translateY(-8px)', boxShadow: '0 18px 38px rgba(0,0,0,.24)' }) } },
    { id: 'float-loop', label: 'Float', category: 'Motion', description: 'Gentle ambient motion', config: { name: 'froam-float-loop', duration: 2600, iterations: 0, direction: 'alternate', easing: 'ease-in-out', keyframes: two(frame('translateY(0)'), frame('translateY(-12px)')) } },
    { id: 'orbit', label: 'Orbit', category: 'Motion', description: 'Circular ambient motion', config: { name: 'froam-orbit', duration: 3200, iterations: 0, easing: 'linear', keyframes: [{ id: 'a', offset: 0, properties: frame('rotate(0deg) translateX(10px) rotate(0deg)') }, { id: 'b', offset: 100, properties: frame('rotate(360deg) translateX(10px) rotate(-360deg)') }] } },
    { id: 'drift', label: 'Drift', category: 'Motion', description: 'Slow diagonal movement', config: { name: 'froam-drift', duration: 4200, iterations: 0, direction: 'alternate', easing: 'ease-in-out', keyframes: two(frame('translate3d(-6px,4px,0) rotate(-1deg)'), frame('translate3d(8px,-7px,0) rotate(1deg)')) } },
    { id: 'spin-slow', label: 'Slow spin', category: 'Motion', description: 'Continuous rotation', config: { name: 'froam-spin-slow', duration: 6000, iterations: 0, easing: 'linear', keyframes: two(frame('rotate(0deg)'), frame('rotate(360deg)')) } },
    { id: 'marquee-nudge', label: 'Marquee nudge', category: 'Motion', description: 'Short directional loop', config: { name: 'froam-marquee-nudge', duration: 1800, iterations: 0, easing: 'ease-in-out', keyframes: two(frame('translateX(-6px)'), frame('translateX(6px)')) } },
    { id: 'fade-out', label: 'Fade out', category: 'Exit', description: 'Quiet disappearance', config: { name: 'froam-fade-out', duration: 420, fillMode: 'forwards', keyframes: two({ opacity: '1' }, { opacity: '0' }) } },
    { id: 'shrink-away', label: 'Shrink away', category: 'Exit', description: 'Collapse into place', config: { name: 'froam-shrink-away', duration: 440, easing: 'cubic-bezier(.55,0,1,.45)', fillMode: 'forwards', keyframes: two(frame('scale(1)', '1'), frame('scale(.72)', '0')) } },
    { id: 'slide-away', label: 'Slide away', category: 'Exit', description: 'Leave toward the right', config: { name: 'froam-slide-away', duration: 480, fillMode: 'forwards', keyframes: two(frame('translateX(0)', '1'), frame('translateX(48px)', '0')) } },
    { id: 'blur-away', label: 'Blur away', category: 'Exit', description: 'Dissolve out of focus', config: { name: 'froam-blur-away', duration: 520, fillMode: 'forwards', keyframes: two({ filter: 'blur(0)', opacity: '1' }, { filter: 'blur(14px)', opacity: '0' }) } },
];
export function animationPresetInteraction(preset, nodeId) {
    const config = preset.config;
    return {
        id: `preset:${preset.id}:${nodeId}`,
        name: preset.label,
        sourceId: nodeId,
        targetIds: [nodeId],
        trigger: config.trigger ?? 'load',
        timeline: (config.keyframes ?? []).map((keyframe) => ({ at: keyframe.offset / 100, values: { ...keyframe.properties }, easing: config.easing })),
        durationMs: config.duration ?? 600,
        delayMs: config.delay ?? 0,
        metadata: { presetId: preset.id, category: preset.category, iterations: config.iterations ?? 1, direction: config.direction ?? 'normal', fillMode: config.fillMode ?? 'both' },
    };
}
//# sourceMappingURL=FroamAnimationPresets.js.map