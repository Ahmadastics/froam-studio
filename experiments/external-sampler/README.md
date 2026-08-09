# Froam External Sampler prototype

Unpacked Manifest V3 research prototype. Clicking the extension explicitly
grants `activeTab` access and injects the recorder into that tab only. It records
allowlisted computed styles, geometry, events, and observable mutations.

It never reads input values, cookies, headers, network responses, page source,
or framework-private state. Password/token/payment-like inputs are excluded.
The result stays in extension-local storage for explicit import/review.

Known limits: cross-origin iframes, closed Shadow DOM, Canvas/WebGL, video,
complex SVG, CSP boundaries, and server/framework-hidden state. This is an
Experimental prototype, not a production extension package.
