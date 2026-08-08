# Froam v7.2 storage and performance report

Recorded 2026-08-09 on Windows x64 with Node 24.14.0. Run with
`npm run benchmark:v7.2`. These are synthetic DOM/project fixtures, not a
promise about every browser or application.

## Storage design

The canonical `FroamProjectDocument` and its event IDs are unchanged. The v1
packed representation is a storage encoding around that document:

- repeated or large immutable strings become deterministic, content-addressed blob references;
- checkpoint DNA with a valid scan-derived fingerprint is omitted and deterministically regenerated from its Scan record;
- edited DNA fails the fingerprint and remains stored in full;
- unpacking must recreate the canonical document exactly. Compaction is rejected if JSON equivalence, event IDs, or checkpoint IDs differ.

This is storage-only compaction. It does not delete semantic events, change
Replay/Archaeology, or introduce another collaboration transport. IndexedDB
accepts old full documents and packed documents. The quota-safe `localStorage`
record remains only a bounded recovery snapshot.

## Size profile

The 5,000-node canonical project was 33,802,355 bytes. Its largest overlapping
categories were checkpoint state (33,801,996), Scan/provenance (14,949,615),
DNA (14,518,369), styles within DNA (3,447,683), nodes (2,590,262), and graph
relations (1,743,434). Repeated strings represented 12,084,395 avoidable bytes.
Categories overlap deliberately and must not be summed.

Packed size was 19,479,155 bytes: a 42.37% reduction. At 10,000 nodes the
project fell from 67,881,018 to 39,163,566 bytes, a 42.31% reduction.

## Timings

| Nodes | Scan | DNA | Graph | Attention | Cinema | Serialize | Save | Load | Replay |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 500 | 17.90 ms | 3.31 ms | 8.61 ms | 1.28 ms | 4.75 ms | 7.47 ms | 98.09 ms | 26.38 ms | 0.07 ms |
| 1,000 | 16.21 ms | 6.07 ms | 2.50 ms | 1.30 ms | 5.34 ms | 18.35 ms | 156.89 ms | 44.99 ms | 0.01 ms |
| 5,000 | 89.59 ms | 15.56 ms | 21.43 ms | 4.26 ms | 23.87 ms | 84.56 ms | 830.65 ms | 253.32 ms | 0.02 ms |
| 10,000 | 217.98 ms | 85.63 ms | 55.19 ms | 13.15 ms | 53.16 ms | 267.50 ms | 3,372.41 ms | 876.54 ms | 0.10 ms |

Archive similarity remained below 0.22 ms. Measured heap delta was about 19.0
MiB (500), 40.0 MiB (1,000), 156.2 MiB (5,000), and 42.1 MiB (10,000). The
non-monotonic final value reflects garbage collection; this is not a retained
heap snapshot.

## Limitations

The 5,000-node save is sub-second on this machine, but a 10,000-node packed save
still blocks for multiple seconds and peak allocation remains high. A
worker/incremental encoder and retained-heap profiling are pre-v8 production
work. Structural component factoring is confidence-gated and is not
automatically applied. Binary image/thumbnail blobs still need a host blob
adapter for equivalent practical savings.

