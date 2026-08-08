export type FroamIdentityTelemetryMethod = 'stable-id' | 'registry' | 'path' | 'fingerprint' | 'attribute-lost' | 'ambiguous' | 'failed' | 'duplicate-prevented';
export type FroamIdentityTelemetrySnapshot = {
    version: 1;
    local: true;
    startedAt: number;
    updatedAt: number;
    total: number;
    counts: Record<FroamIdentityTelemetryMethod, number>;
};
export declare function createIdentityTelemetry(now?: number): {
    record(method: FroamIdentityTelemetryMethod, count?: number, at?: number): void;
    snapshot(): FroamIdentityTelemetrySnapshot;
};
export declare function identityTelemetryRates(snapshot: FroamIdentityTelemetrySnapshot): Record<FroamIdentityTelemetryMethod, number>;
/** Remote adapters may receive this aggregate only; no DOM text, paths, URLs or project data exist in the contract. */
export type FroamIdentityTelemetryExporter = {
    id: string;
    optInRequired: true;
    send(snapshot: FroamIdentityTelemetrySnapshot): Promise<void>;
};
export declare function aggregateIdentityDiagnostics(events: ReadonlyArray<{
    type: string;
    at: number;
}>, startedAt?: number): FroamIdentityTelemetrySnapshot;
//# sourceMappingURL=identity-telemetry.d.ts.map