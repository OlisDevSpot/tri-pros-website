# Task: Meta Ads Integration

**Status:** 🟡 BLOCKED — all scripts built; blocked on Meta app needing to be Published before `pnpm meta init-account` can run. See `docs/meta-ads-session-handoff.md` for full context.
**Branch:** `main`
**Plan:** `docs/superpowers/plans/2026-03-18-meta-ads-integration.md`
**Date Planned:** 2026-03-18

---

## One-liner

Integrate Meta Marketing API to track lead sources, ad attribution, and campaign performance — feeding data back into the customer pipeline.

---

## How to Resume

Start a new Claude Code session and say:
> "I want to execute the Meta Ads integration plan. The plan is at `docs/superpowers/plans/2026-03-18-meta-ads-integration.md`. Invoke the `executing-plans` skill."

---

## Key Changes (summary)

- `scripts/meta/` scripts for Marketing API access
- Track lead source (`facebook_ad`, `instagram_ad`, etc.) on customer creation
- Campaign/ad set/ad ID stored on customer or lead record
- Dashboard widget showing leads by ad source

---

## Dependencies

- **Blocks:** Nothing
- **Blocked by:** Nothing (but more useful after Notion migration so customers are native DB records)
