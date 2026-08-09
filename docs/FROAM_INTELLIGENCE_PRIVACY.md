# Froam Intelligence: privacy and model boundary

Froam 8 ships no AI model and sends no Scan, DNA, screenshot, source code,
credentials or project data to a remote service.

The v8 Interface Laboratory remains local by default. Native Sampling observes
only the live DOM controlled by Froam. The optional unpacked External Sampling
prototype requires a user action on the active origin, visibly indicates the
session, excludes source code and sensitive form values, sanitizes styles and
geometry, applies size limits and stores only a bounded extension-local result.
Its output records the origin and unsupported signals, not page contents.

Imported UI Sound assets remain project assets; preview requires a user gesture.
Chaos and Synthetic UX operate through local adapters and project state. Reality
rectification processes supplied pixels locally. Worker packing transfers the
canonical project to a local browser Worker and writes the same-origin
IndexedDB; it is not a network transport.

## Local analyses in v7

- Froam Scan reads the selected live DOM and browser-computed styles locally.
- Component family, Visual Rhythm and responsive suggestions use deterministic
  local rules over Scan records.
- Predicted Attention uses a labelled local heuristic. It is not eye tracking.
- Screenshot → Live UI decodes and segments pixels in the browser. The imported
  image is not uploaded by Froam.
- v7.1 OCR uses the browser's local `TextDetector` API when the host exposes it.
  When unavailable or unsuccessful, Froam records that state and does not
  fabricate text. Custom future OCR providers remain subject to the same
  local/remote disclosure and explicit-consent contract.
- Screenshot validation captures only the newly reconstructed Froam frame in
  the browser and compares equal-sized pixel buffers locally.

The resulting records are stored with the project's normal local/sidecar
project envelope. Existing host applications may choose their own persistence
transport; that is separate from analysis.

## Replaceable providers

`FroamIntelligenceProvider` is the boundary for future model-backed work. A
provider must describe:

- whether processing is local or remote;
- what minimum data it needs;
- its privacy disclosure;
- whether explicit user consent was supplied.

Froam refuses to invoke a remote provider without explicit consent. Provider
implementations should minimize payloads, omit source credentials/secrets and
avoid sending complete projects when a scan record or cropped region suffices.

Identity-health telemetry is aggregated locally by recovery method. It does not
collect DOM text, project content, source code, URLs, individual node IDs, or
fingerprints. Its optional remote exporter receives aggregate counters/rates
only and must be explicitly enabled and disclosed.

Adding a provider does not make its output an observed fact. Model results must
remain inferred analysis with confidence/provenance, and the UI must retain an
honest maturity label.
