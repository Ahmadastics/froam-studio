# Froam v7.1 Intelligence performance baseline

Measured on 2026-08-08 with Node v24.14.0, Windows x64 using
`npm run benchmark:v7.1`. These are deterministic synthetic DOM/record
fixtures, not claims about every browser or framework application.

| Nodes | Scan | DNA | Graph | Archive similarity | Attention | Rhythm | Cinema observation | Serialization | Serialized size | Heap used |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 500 | 17.6 ms | 4.5 ms | 11.9 ms | 0.21 ms | 1.15 ms | 0.57 ms | 4.4 ms | 9.3 ms | 3.35 MB | 13.5 MB |
| 1,000 | 17.0 ms | 4.2 ms | 1.6 ms | 0.01 ms | 1.10 ms | 0.37 ms | 4.7 ms | 20.3 ms | 6.73 MB | 26.0 MB |
| 5,000 | 75.6 ms | 34.2 ms | 23.9 ms | 0.03 ms | 6.02 ms | 2.76 ms | 26.4 ms | 106.1 ms | 33.80 MB | 75.6 MB |

Heap is total process heap at the end of each scenario, not isolated retained
memory. Timing variability explains the non-monotonic small-fixture results.

## Findings and changes

- The first 5,000-node profile exposed quadratic registry object copying and
  repeated registry searches: Scan took roughly 10.3 seconds. Indexed matching
  plus an owned batch registry reduced the same fixture to about 76 ms.
- Graph relations are indexed once. Responsive collision candidates are
  spatially bucketed. Archive exact similarities are signature-bucketed.
- DNA provenance stores category source markers and detailed field entries only
  when inference/confidence needs them. Latest materialized scans replace the
  previous scan for the same node.
- Regional `scanDomChanges` exists because large/full rescans are avoidable when
  a mutation identifies the affected subtree.

## Remaining concern

The synthetic 5,000-node Scan+DNA materialized state is approximately 33.8 MB.
Normal UI scans are capped and incremental invalidation reduces churn, but
project-event compaction/blob deduplication should be designed before routinely
persisting several full 5,000-node historical scans or enabling hosted
intelligence synchronization by default.
