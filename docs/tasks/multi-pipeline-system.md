# Task: Multi-Pipeline Customer System

**Status:** ✅ COMPLETE — verified 2026-03-19
**Branch:** `main`
**Spec:** `docs/superpowers/specs/2026-03-18-multi-pipeline-customer-system-design.md`
**Plan:** `docs/superpowers/plans/2026-03-18-multi-pipeline-customer-system.md`
**Date Planned:** 2026-03-18

---

## One-liner

Add `pipeline` and `pipelineStage` columns to customers, plus a toggle UI to switch between Active / Rehash / Dead pipeline views — the foundation for multi-pipeline customer management.

---

## Current State

Commits show the `pipeline` + `pipelineStage` columns were added and the toggle UI was merged. Check the plan to see if any steps remain open.

---

## How to Resume

Start a new Claude Code session and say:
> "I want to review and complete the multi-pipeline customer system plan. The plan is at `docs/superpowers/plans/2026-03-18-multi-pipeline-customer-system.md`. Check what's already done and what remains."

---

## Key Changes (summary)

- `pipeline: pgEnum` column — `active | rehash | dead`
- `pipelineStage: text` column — stage within the pipeline
- Customer pipeline view shows only customers in the selected pipeline
- Toggle UI (Active / Rehash / Dead) in pipeline view header
- Move customer between pipelines (drag or action)

---

## Dependencies

- **Blocks:** Enhances the pipeline-native-customers task context
- **Blocked by:** Nothing (already partially done)
