export function legacyAnimatorToInteraction(config, input) {
    const timeline = [...config.keyframes]
        .sort((a, b) => a.offset - b.offset)
        .map((keyframe) => ({ at: keyframe.offset / 100, values: { ...keyframe.properties }, easing: config.easing }));
    return {
        id: input.id,
        name: config.name,
        sourceId: input.sourceId,
        targetIds: input.targetIds?.length ? input.targetIds : [input.sourceId],
        trigger: config.trigger,
        timeline,
        durationMs: config.duration,
        delayMs: config.delay,
        metadata: {
            legacyAnimator: { iterations: config.iterations, direction: config.direction, fillMode: config.fillMode },
            compilerTarget: 'css-keyframes',
        },
    };
}
export function interactionInspectorRecord(interaction) {
    return {
        trigger: interaction.trigger,
        source: interaction.sourceId,
        targets: interaction.targetIds,
        state: { from: interaction.fromState ?? null, to: interaction.toState ?? null },
        timeline: interaction.timeline,
        physics: interaction.physics ?? null,
        sound: interaction.feedback?.soundAssetId ?? null,
        compilerTarget: String(interaction.metadata?.compilerTarget ?? 'css-keyframes'),
    };
}
//# sourceMappingURL=animator-adapter.js.map