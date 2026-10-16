/**
 * The address as it is safe to write into a page, or null. Relative
 * addresses (another page, `#a-section`, a file) are kept as they are.
 */
export declare function safeHref(raw: unknown): string | null;
export type LinkKind = 'web' | 'whatsapp' | 'call' | 'email' | 'page';
export declare const LINK_KINDS: ReadonlyArray<{
    id: LinkKind;
    label: string;
    placeholder: string;
    hint: string;
}>;
/** A number as digits (a leading + is dropped), or '' when it can't be a phone number. */
export declare function linkDigits(value: string): string;
/** What kind of link an address is, and the part of it a person would type. */
export declare function readLink(href: string | null | undefined): {
    kind: LinkKind;
    value: string;
    message?: string;
};
/**
 * The address for what was typed, or an explanation of what's missing.
 * `message` is WhatsApp's opening line, kept when a number is changed.
 */
export declare function writeLink(kind: LinkKind, typed: string, message?: string): {
    href: string;
} | {
    problem: string;
};
/**
 * The places on this site a link can go: the pages its links already point
 * at, and the sections of this page that have a name (an id).
 */
export declare function linkDestinations(root: ParentNode | null): Array<{
    href: string;
    label: string;
}>;
//# sourceMappingURL=links.d.ts.map