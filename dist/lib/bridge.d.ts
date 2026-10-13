/**
 * Repo-Mode bridge resolution.
 *
 * In a Vite app the bridge endpoints (/__froam/repo/*) live on the same
 * origin (vite plugin middleware). In standalone mode (`froam dev`) the
 * editor may be injected into a page served from a different origin, so
 * the loader records the bridge origin on window and every repo call
 * routes through it.
 */
export declare function getBridgeOrigin(): string;
export declare function bridgeUrl(path: string): string;
/** This device's pairing key, picking it up from the address on first sight. */
export declare function pairedDeviceKey(): string | null;
export declare function bridgeClientId(): string;
/** Headers for a bridge request: this editor, and the pairing key when this device has one. */
export declare function bridgeHeaders(extra?: Record<string, string>): Record<string, string>;
//# sourceMappingURL=bridge.d.ts.map