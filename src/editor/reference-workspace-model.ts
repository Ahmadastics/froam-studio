import type { FroamReferenceQuality } from '../project/reference-intelligence'
import { FROAM_INTELLIGENCE_CONSENT_KEY, readFroamIntelligenceConsent, writeFroamIntelligenceConsent, type FroamIntelligenceConsent } from './intelligence-consent'

export const FROAM_REFERENCE_CONSENT_KEY = FROAM_INTELLIGENCE_CONSENT_KEY
export const FROAM_REFERENCE_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const FROAM_REFERENCE_MAX_PIXELS = 20_000_000
export const FROAM_REFERENCE_MAX_REFERENCES = 20
export type FroamReferenceConsent = FroamIntelligenceConsent

export function validateReferenceFile(input: { type: string; size: number }) {
  if (!FROAM_REFERENCE_ACCEPTED_TYPES.includes(input.type as (typeof FROAM_REFERENCE_ACCEPTED_TYPES)[number])) return { valid: false as const, reason: 'Use a PNG, JPEG or WebP screenshot' }
  if (!Number.isFinite(input.size) || input.size <= 0) return { valid: false as const, reason: 'The screenshot file is empty' }
  return { valid: true as const }
}

export function validateReferenceDimensions(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 16 || height < 16) return { valid: false as const, reason: 'The screenshot dimensions are invalid' }
  if (width * height > FROAM_REFERENCE_MAX_PIXELS) return { valid: false as const, reason: 'The screenshot exceeds Froam’s 20 megapixel reconstruction limit' }
  return { valid: true as const }
}

/** A suggestion from observable width, never a claim about the originating device. */
export function suggestReferenceLabel(width: number) { return width < 640 ? 'Mobile' : width < 1024 ? 'Tablet' : 'Desktop' }

export function referenceQualityLabel(value: number | undefined) {
  if (value === undefined) return { label: '—', detail: 'Not measured', tone: 'unknown' as const }
  if (value >= .85) return { label: 'Strong', detail: `${Math.round(value * 100)}% measured`, tone: 'strong' as const }
  if (value >= .7) return { label: 'Good', detail: `${Math.round(value * 100)}% measured`, tone: 'good' as const }
  if (value >= .5) return { label: 'Moderate', detail: `${Math.round(value * 100)}% measured`, tone: 'moderate' as const }
  return { label: 'Limited', detail: `${Math.round(value * 100)}% measured`, tone: 'limited' as const }
}

export function referenceQualityRows(quality: FroamReferenceQuality) {
  return [
    ['Structure', referenceQualityLabel(quality.structure)],
    ['Geometry', referenceQualityLabel(quality.geometry)],
    ['Text', referenceQualityLabel(quality.text)],
    ['Responsive', referenceQualityLabel(quality.responsiveEvidence)],
    ['Visual', referenceQualityLabel(quality.visual)],
  ] as const
}

export function readReferenceConsent(storage?: Pick<Storage, 'getItem'>): FroamReferenceConsent {
  return readFroamIntelligenceConsent(storage)
}

export function writeReferenceConsent(storage: Pick<Storage, 'setItem'> | undefined, value: Exclude<FroamReferenceConsent, 'unknown'>) {
  return writeFroamIntelligenceConsent(storage, value)
}
