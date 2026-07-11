export type FroamPersona = {
    name: string;
    tagline: string;
    imageUrl: string;
    accentColor: string;
    role: string;
};
type PersonaDraftLike = {
    text?: string;
};
export declare const PERSONA_STORAGE_KEY = "froam-studio-persona-v1";
export declare const FROAM_PERSONA_PATH = "__froam_persona__:profile";
export declare const DEFAULT_FROAM_PERSONA: FroamPersona;
export declare function isFroamPersonaPath(path: string): path is "__froam_persona__:profile";
export declare function sanitizeFroamPersona(input?: Partial<FroamPersona> | null): FroamPersona;
export declare function readFroamPersonaDraft(store?: Record<string, PersonaDraftLike | undefined> | null): FroamPersona | null;
export declare function getFroamPersonaInitials(name: string): string;
export {};
//# sourceMappingURL=froamPersona.d.ts.map