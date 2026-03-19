# Task: Services Pages Redesign

**Status:** 🔵 PARTIALLY DONE — routes + components built but not satisfied with results; needs redesign
**Branch:** `main`
**Spec:** `docs/superpowers/specs/2026-03-18-services-pages-redesign.md`
**Plan:** `docs/superpowers/plans/2026-03-18-services-pages-redesign.md`
**Date Planned:** 2026-03-18

---

## One-liner

Build pillar service pages (one per trade) from Notion content with ISR — SEO-optimized, trade-specific landing pages that drive in-home appointment leads.

---

## How to Resume

Start a new Claude Code session and say:
> "I want to execute the services pages redesign plan. The plan is at `docs/superpowers/plans/2026-03-18-services-pages-redesign.md`. Invoke the `executing-plans` skill."

---

## Key Changes (summary)

- Fetch trade content from Notion (pillar page structure per trade)
- Generate `/services/[trade]` routes with ISR revalidation
- SEO metadata per trade page
- CTA sections driving to contact/appointment form

---

## Dependencies

- **Blocks:** Nothing
- **Blocked by:** Nothing
