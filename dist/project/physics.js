export const FROAM_PHYSICS_PRESETS = {
    'Soft Spring': { mass: 1, stiffness: 95, damping: 18, friction: .04, bounce: .08, initialVelocity: 0, resistance: .08, attraction: 0 },
    Heavy: { mass: 3.6, stiffness: 150, damping: 32, friction: .18, bounce: .02, initialVelocity: 0, resistance: .32, attraction: 0 },
    Elastic: { mass: .7, stiffness: 240, damping: 9, friction: .015, bounce: .62, initialVelocity: 0, resistance: .03, attraction: 0 },
    Snappy: { mass: .55, stiffness: 390, damping: 31, friction: .06, bounce: .08, initialVelocity: 0, resistance: .04, attraction: 0 },
    Float: { mass: .55, stiffness: 52, damping: 9, friction: .01, bounce: .18, initialVelocity: 0, resistance: .015, attraction: .08 },
    Sticky: { mass: 1.5, stiffness: 115, damping: 38, friction: .48, bounce: 0, initialVelocity: 0, resistance: .7, attraction: .18 },
    Magnetic: { mass: .9, stiffness: 180, damping: 21, friction: .04, bounce: .12, initialVelocity: 0, resistance: .06, attraction: .8 },
    Rubber: { mass: .8, stiffness: 285, damping: 13, friction: .03, bounce: .78, initialVelocity: 0, resistance: .04, attraction: 0 },
};
export function normalizePhysics(input) { return { mass: Math.max(.01, input.mass ?? 1), stiffness: Math.max(0, input.stiffness ?? 170), damping: Math.max(0, input.damping ?? 26), friction: Math.max(0, input.friction ?? 0), bounce: Math.max(0, Math.min(1, input.bounce ?? 0)), initialVelocity: input.initialVelocity ?? 0, resistance: Math.max(0, input.resistance ?? 0), attraction: Math.max(0, input.attraction ?? 0), preset: input.preset }; }
export function physicsPreset(name) { return normalizePhysics({ ...FROAM_PHYSICS_PRESETS[name], preset: name }); }
export function stepSpring(state, target, physicsInput, deltaSeconds) { const physics = normalizePhysics(physicsInput); const dt = Math.max(0, Math.min(.05, deltaSeconds)); const displacement = state.position - target; const spring = -physics.stiffness * displacement; const damping = -physics.damping * state.velocity; const attraction = -Math.sign(displacement) * physics.attraction * Math.min(Math.abs(displacement), 100); const velocity = (state.velocity + ((spring + damping + attraction) / physics.mass) * dt) * Math.max(0, 1 - (physics.friction + physics.resistance) * dt); let position = state.position + velocity * dt; let nextVelocity = velocity; if ((state.position - target) * (position - target) < 0 && physics.bounce > 0) {
    position = target + (target - position) * physics.bounce;
    nextVelocity = -velocity * physics.bounce;
} return { velocity: nextVelocity, position }; }
export function stepSpring2D(state, target, physics, deltaSeconds) { return { x: stepSpring(state.x, target.x, physics, deltaSeconds), y: stepSpring(state.y, target.y, physics, deltaSeconds) }; }
export function simulateThrow(input) { let state = { position: input.position ?? 0, velocity: input.velocity }; const frames = [state]; for (let index = 0; index < Math.max(1, input.frames ?? 120); index += 1) {
    state = stepSpring(state, input.target, input.physics, input.stepSeconds ?? 1 / 60);
    frames.push(state);
} return frames; }
export function interactionWithPhysics(interaction, input) { const physics = normalizePhysics(input); return { ...interaction, physics: { preset: physics.preset ?? 'custom', stiffness: physics.stiffness, damping: physics.damping, mass: physics.mass, friction: physics.friction, bounce: physics.bounce, velocity: physics.initialVelocity, resistance: physics.resistance, attraction: physics.attraction }, metadata: { ...interaction.metadata, physics: { ...physics, compiler: 'froam-physics-runtime-v2' } } }; }
export function compilePhysicsRuntime(interaction) { const physics = normalizePhysics(interaction.metadata?.physics ?? { ...interaction.physics, initialVelocity: interaction.physics?.velocity }); return { kind: 'froam-physics-runtime', version: 2, interactionId: interaction.id, physics, deterministicStep: 'semi-implicit-euler', fixedStepSeconds: 1 / 60, requiresRuntime: true }; }
export function gravityForce(input, source, target) { const dx = target.x - source.x; const dy = target.y - source.y; const distance = Math.max(.001, Math.hypot(dx, dy)); if (distance > input.radius && !['follow', 'anchor'].includes(input.mode))
    return { x: 0, y: 0 }; const sign = input.mode === 'repel' || input.mode === 'avoid' ? -1 : 1; const falloff = ['follow', 'anchor'].includes(input.mode) ? 1 : Math.max(0, 1 - distance / Math.max(1, input.radius)); return { x: dx / distance * input.strength * falloff * sign, y: dy / distance * input.strength * falloff * sign }; }
export function interactionWithGravity(interaction, gravity) { if (['stay-near', 'avoid', 'group'].includes(gravity.mode) && !gravity.labOnly)
    throw new Error('Layout Gravity remains Lab-only'); return { ...interaction, metadata: { ...interaction.metadata, gravity: { ...gravity, version: 1, experimental: true } } }; }
//# sourceMappingURL=physics.js.map