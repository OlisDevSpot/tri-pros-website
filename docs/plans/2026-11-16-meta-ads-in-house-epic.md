# Meta ads in-house — epic tracker

**Live status:** https://claude.ai/artifact/Mn6ymrN5VPqkdTWoTMSYt6 (workstreams, every requirement with its state, owner decisions). That page's database is the one place requirement and decision status lives; this file holds the why and the shape. Lane `meta-ads` on the Parallel Ship Flow board (https://claude.ai/artifact/7D8kgccA7iy6f8ATWzLdqS).

## Why

Most leads today come from Bina's general Meta program, delivered through Bina's white-labelled GoHighLevel. Tri Pros-branded ads run in our own funnels (kitchens, bathrooms) with pixel + CAPI, but the ad side has not moved since 2026-08-09. The owner wants a standardized, in-house system that produces branded Meta leads, handles them fast, and shows every ad dollar's result in our own app.

## Goals, non-goals, anti-goals

- **Goals:** branded offers and creative on a weekly cadence; a landing system that converts paid clicks; leads answered in minutes with recordings and history; every lead traced from ad to kept appointment to signed contract, and that signal sent back to Meta.
- **Non-goals (for now):** replacing Bina's program; solar (Tri Pros no longer sells it); prices in ads.
- **Anti-goals:** judging ads by cost per lead alone; raising spend before the Phase 1 gate; AI-generated "customers"; a second CRM that drifts from our app.

## Shape

| Phase | Sub-plans | Gate |
| --- | --- | --- |
| 0 Decide | MK0 ground truth and cleanup · MK1 strategy, offers, operating model | Owner decisions D01–D05, D29 |
| 1 Trust the data | MK2 compliance and consent · MK3 measurement and closed loop · MK4 observability | No spend increase until every Phase 1 gate item is done |
| 2 Build the engine | MK5 lead handling (GoHighLevel) · MK6 landing system v2 · MK7 creative engine | |
| 3 Run and optimize | MK8 Meta account and campaigns · MK9 reporting, testing loop, competitor intel | |

## How it runs

One sub-plan at a time: brainstorm → spec (`docs/superpowers/specs/`) → plan → build → live. When a sub-plan reaches spec it gets its own lane on the ship board and its workstream row on the tracker gets `stage`, `spec`, `plan`, `lane`. A session that finishes work updates the requirement rows it closed (ArtifactData, `requirements/<id>` `state`), and applies answered decisions (`decisions/<id>`, set `appliedOn`).

Existing material the sub-plans build on: `docs/marketing/showcase-offer.md`, `docs/marketing/assistance-offer.md`, `.claude/skills/showcase-ads/`, `scripts/meta/`, `docs/plans/meta-capi-phase2-handoff.md`, `docs/superpowers/specs/2026-07-30-observability-infrastructure-design.md` (+ its plan), `docs/superpowers/specs/2026-08-09-showcase-ads-optimization-round-1-epic-design.md`, the mobile playbook doc https://claude.ai/artifact/Cb8eYMoAPSbu9u14PLJfok.

## Status

- **Stage:** Phase 0, 2026-11-16. Tracker seeded from six research reports (Meta integration, funnels, creative, analytics, lead handling + compliance, web research): 138 requirements (14 done, 23 partial, 101 open; 30 spend-gate items), 29 owner decisions.
- **Next:** owner answers D01–D05 and D29 on the tracker; then brainstorm MK1.
