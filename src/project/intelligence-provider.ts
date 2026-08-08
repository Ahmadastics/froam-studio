import type { FroamAnalysis, FroamScanRecord } from './types'

export type FroamProviderPrivacy = {
  execution: 'local' | 'remote'
  sendsSourceCode: boolean
  sendsCredentials: boolean
  dataDescription: string
}

export type FroamIntelligenceProvider = {
  id: string
  privacy: FroamProviderPrivacy
  analyze?(records: readonly FroamScanRecord[]): Promise<FroamAnalysis>
}

export const LOCAL_HEURISTIC_PROVIDER: FroamIntelligenceProvider = {
  id: 'froam-local-heuristics-v1',
  privacy: {
    execution: 'local', sendsSourceCode: false, sendsCredentials: false,
    dataDescription: 'Computed geometry, selected style values and semantic DOM metadata only.',
  },
}

export function assertRemoteProviderConsent(provider: FroamIntelligenceProvider, consent: boolean) {
  if (provider.privacy.execution === 'remote' && !consent) throw new Error(`Remote analysis by ${provider.id} requires explicit consent`)
}
