# External UI Sampling feasibility

Status: research/interface contract only in v7.2. The shipped Labs sampler is
limited to Froam-controlled DOM. Froam reconstructs observable behavior; it
does not claim to recover or copy another site's implementation.

## Proposed extension boundary

An explicitly installed browser extension would use a least-privilege content
script for user-approved origins. A capture session would emit time-stamped,
sanitized observations: event kind, semantic source role, target relationships,
bounding boxes, visibility, selected computed-style fields, transforms,
opacity, and MutationObserver summaries. It would not send page source,
cookies, form values, credentials, or arbitrary text by default.

```ts
type FroamSamplingBridgeMessage = {
  version: 1
  sessionId: string
  type: 'session-start' | 'frame' | 'session-stop' | 'error'
  origin: string
  elapsedMs: number
  observations?: Array<{
    role: string
    event?: string
    geometry?: { x: number; y: number; width: number; height: number }
    styles?: Record<string, string | number>
    mutation?: 'attributes' | 'child-list' | 'visibility'
  }>
}
```

Froam would validate origin/session/size, map observations to semantic recipe
roles, and save a `sampled` Interaction Library item. Raw observations should
be transient unless the user explicitly keeps them.

## Feasibility and constraints

- Ordinary same-origin DOM supports event capture, MutationObserver, geometry, opacity, transforms, and selected computed styles.
- CSS animation can be sampled visually, but original keyframes, easing, and JavaScript intent cannot be proven.
- Closed Shadow DOM is opaque; open Shadow DOM needs explicit traversal.
- Cross-origin iframes need separate permission and coordination, and many cannot be inspected.
- Canvas/WebGL expose pixels, not component or interaction semantics.
- CSP, extension isolation, permissions, and framework rerenders require an extension-specific matrix.
- Private data can appear in text, attributes, state, and forms. Recording needs an indicator, origin allowlist, review, and deletion.
- Reconstruction must not ingest source code, hidden assets, proprietary data, or bypass access controls.

No external sampler ships in v7.2. The next justified experiment is a
permission-minimal extension against owned test pages, followed by privacy
review and an observable-behavior accuracy corpus.

