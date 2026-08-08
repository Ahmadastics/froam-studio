# Froam Intelligence: privacy and model boundary

Froam 7 ships no AI model and sends no Scan, DNA, screenshot, source code,
credentials or project data to a remote service.

## Local analyses in v7

- Froam Scan reads the selected live DOM and browser-computed styles locally.
- Component family, Visual Rhythm and responsive suggestions use deterministic
  local rules over Scan records.
- Predicted Attention uses a labelled local heuristic. It is not eye tracking.
- Screenshot → Live UI decodes and segments pixels in the browser. The imported
  image is not uploaded by Froam.

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

Adding a provider does not make its output an observed fact. Model results must
remain inferred analysis with confidence/provenance, and the UI must retain an
honest maturity label.
