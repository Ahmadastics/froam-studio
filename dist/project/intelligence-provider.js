export const LOCAL_HEURISTIC_PROVIDER = {
    id: 'froam-local-heuristics-v1',
    privacy: {
        execution: 'local', sendsSourceCode: false, sendsCredentials: false,
        dataDescription: 'Computed geometry, selected style values and semantic DOM metadata only.',
    },
};
export function assertRemoteProviderConsent(provider, consent) {
    if (provider.privacy.execution === 'remote' && !consent)
        throw new Error(`Remote analysis by ${provider.id} requires explicit consent`);
}
//# sourceMappingURL=intelligence-provider.js.map