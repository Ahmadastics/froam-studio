export const DEFAULT_PLAYBACK = { autoplay: true, loop: true, muted: true, controls: false };
export function readMediaDraft(value) {
    if (typeof value !== 'string' || !value)
        return null;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && (parsed.kind === 'image' || parsed.kind === 'video') ? parsed : null;
    }
    catch {
        return null;
    }
}
/** Keys in one order, so an unchanged media draft is an unchanged string (no op, no save). */
export function writeMediaDraft(media) {
    const ordered = {};
    for (const key of ['kind', 'method', 'src', 'srcset', 'sizes', 'poster', 'playback', 'source', 'fit']) {
        if (media[key] !== undefined)
            ordered[key] = media[key];
    }
    return JSON.stringify(ordered);
}
//# sourceMappingURL=media-draft.js.map