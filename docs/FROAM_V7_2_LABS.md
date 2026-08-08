# Froam v7.2 Labs architecture

Every Lab is independently disabled by default and shown only in the separate
Froam Labs surface.

## MUTATE

`FroamMutationProvider` receives materialized graph/DNA, scope, level,
constraints, seed, and time, then returns reviewable project-event proposals.
The service creates a child branch first, writes only to that branch, and
records source branch/checkpoint, provider/version, level, operation IDs,
scope, constraints, and time. The local provider is deterministic. Comparison
is summary/switch-level; merge is absent.

## Interaction Library

Recipes wrap `FroamInteraction` with semantic source/target roles and native or
sampled provenance. Browse/save, rename, duplicate, delete, inspect, and apply
use explicit role bindings, so recipes are portable across node IDs. Physics
and future sound/compiler metadata remain compatible slots.

## Native Sampling

A session records ordered observable frames for Froam-controlled targets:
trigger, role, computed style, transform/opacity, geometry, visibility, and
timing. Conversion creates a portable sampled recipe and labels it as Froam's
reconstruction. Automatic deep event/mutation capture and external origins are
not production-ready.

## Design Physics and Gravity

Mass, stiffness, damping, friction, bounce, and velocity normalize into
interaction metadata. The compiler emits a versioned semi-implicit-Euler
runtime contract. Motion Gravity has an experimental attract/repel/follow
description; complex layout gravity and orbits are absent.

## Simulation preparation

Scenario contracts cover viewport, network, missing assets, long/empty content,
locale, session, permissions, API failure, and input. There is no full Chaos
Testing UI or synthetic-user claim in v7.2.

