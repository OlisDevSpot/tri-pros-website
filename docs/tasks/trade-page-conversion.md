# Task: Trade Page Conversion

**Status:** 🔵 PARTIALLY DONE — commits show partial implementation; check remaining steps
**Branch:** `main`
**Spec:** `docs/superpowers/specs/2026-03-18-trade-page-conversion.md`
**Plan:** `docs/superpowers/plans/2026-03-18-trade-page-conversion.md`
**Date Planned:** 2026-03-18

---

## One-liner

Convert static trade pages to dynamic DB-driven pages — trade name as H1, pain headline as description, benefits populated for each trade.

---

## Current State

Recent commits include: "fix(trade-page): tradeName as H1, painHeadline as description, fill benefits for all trades" — some work is done. Check the plan for remaining steps.

---

## How to Resume

Start a new Claude Code session and say:
> "I want to review and complete the trade page conversion plan. The plan is at `docs/superpowers/plans/2026-03-18-trade-page-conversion.md`. Check what's already merged and what remains."

---

## Key Changes (summary)

- Trade pages (`/services/[trade]`) pull data from DB trades table
- `tradeName` renders as H1
- `painHeadline` renders as page description/subtitle
- Benefits section populated from trade-specific data for all trades
- Dynamic routing with `generateStaticParams` for SSG

---

## Dependencies

- **Blocks:** Nothing
- **Blocked by:** Nothing
