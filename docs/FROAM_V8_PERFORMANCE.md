# Froam v8.0 performance and memory report

Recorded 2026-08-09 on Windows x64 with Node 24.14.0. Run
`npm run benchmark:v8` and `npm run profile:memory:v8`. Fixtures are synthetic;
browser, hardware and host application behavior will differ.

## Responsiveness of packed saves

The v8 browser store packs canonical projects in a reused module Worker, then
writes IndexedDB. Pending saves for one project coalesce to the latest document.
The synchronous exact-round-trip packer remains the compatibility fallback.

The Node responsiveness harness creates a worker per measurement, so its wall
time includes startup and structured cloning and is deliberately conservative:

| Nodes | Blocking wall / max heartbeat lag | Worker wall / max heartbeat lag | Worker encode |
| ---: | ---: | ---: | ---: |
| 5,000 | 418.0 / 425.4 ms | 1,052.8 / 242.0 ms | 402.9 ms |
| 10,000 | 849.2 / 854.5 ms | 3,359.5 / 574.8 ms | 1,385.1 ms |

The worker materially reduces main-loop stalls in this fixture, but does not
reduce total latency; cloning and worker startup are visible. The browser
implementation amortizes startup by reusing one worker. Incremental encoding or
transferable storage is still needed for consistently low end-to-end latency.

## Retained-memory profile

With forced GC, five pack/unpack cycles showed no positive retained-growth
signal: -254,216 bytes at 5,000 nodes and -596,504 bytes at 10,000 nodes (both
are normal measurement noise). The created projects retained 11,827,432 and
12,527,744 bytes respectively. Peak additional allocation during the cycles was
47,520,544 and 79,540,672 bytes. The important remaining problem is therefore
transient allocation pressure, not a demonstrated leak.

## v8 experiment scale

In the recorded run, creating eight isolated mutation prototypes took 1.08 ms
for a 5,000-node project and produced 19 events. Searching 5,000 recipes for a
query plus category took 38.39 ms and returned 1,667 matches. At 10,000 project
nodes the bounded recipe fixture remained 5,000 recipes and took 32.06 ms.
These measurements cover service operations, not React rendering.

The storage encoding itself is unchanged from v7.2 and still produces exact
canonical round trips. A later validation run is the release source of truth;
timings should be treated as observations, never guarantees.
