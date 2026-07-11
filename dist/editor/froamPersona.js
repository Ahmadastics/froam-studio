export const PERSONA_STORAGE_KEY = 'froam-studio-persona-v1';
export const FROAM_PERSONA_PATH = '__froam_persona__:profile';
export const DEFAULT_FROAM_PERSONA = {
    name: 'Froam',
    tagline: 'Shape what comes next',
    imageUrl: '',
    accentColor: '#5eead4',
    role: 'Designer',
};
export function isFroamPersonaPath(path) {
    return path === FROAM_PERSONA_PATH;
}
export function sanitizeFroamPersona(input) {
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    const tagline = typeof input?.tagline === 'string' ? input.tagline.trim() : '';
    const imageUrl = typeof input?.imageUrl === 'string' ? input.imageUrl.trim() : '';
    const accentColor = typeof input?.accentColor === 'string' && input.accentColor.trim() ? input.accentColor.trim() : DEFAULT_FROAM_PERSONA.accentColor;
    const role = typeof input?.role === 'string' ? input.role.trim() : DEFAULT_FROAM_PERSONA.role;
    return {
        name: name || DEFAULT_FROAM_PERSONA.name,
        tagline: tagline || DEFAULT_FROAM_PERSONA.tagline,
        imageUrl,
        accentColor,
        role,
    };
}
export function readFroamPersonaDraft(store) {
    const raw = store?.[FROAM_PERSONA_PATH]?.text;
    if (!raw)
        return null;
    try {
        const parsed = JSON.parse(raw);
        return sanitizeFroamPersona(parsed);
    }
    catch {
        return null;
    }
}
export function getFroamPersonaInitials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return 'F';
    if (parts.length === 1)
        return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? 'F'}${parts[1][0] ?? ''}`.toUpperCase();
}
//# sourceMappingURL=froamPersona.js.map