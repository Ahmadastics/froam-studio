export declare function initialsOf(name: string): string;
/**
 * A person's face: their studio-profile photo when they set one, their
 * initials in their colour when they didn't (or the photo fails to load).
 */
export declare function PersonAvatar({ name, color, avatarUrl, size, here, ring, }: {
    name: string;
    color?: string | null;
    avatarUrl?: string | null;
    size?: number;
    /** Adds a presence dot: green when here, grey when away. Omit for no dot. */
    here?: boolean;
    ring?: boolean;
}): import("react").JSX.Element;
//# sourceMappingURL=PersonAvatar.d.ts.map