# Task: Meta Ads Integration

**Status:** 🟡 BLOCKED — all scripts built; blocked on Meta app needing to be Published before `pnpm meta init-account` can run. See `docs/meta-ads-session-handoff.md` for full context.
**Issue:** [#3 Meta Ads Integration](https://github.com/OlisDevSpot/tri-pros-website/issues/3)
**Design spec:** [`docs/plans/meta-ads-compound-intelligence.md`](../plans/meta-ads-compound-intelligence.md)
**Date Planned:** 2026-03-18

---

## One-liner

Integrate Meta Marketing API to track lead sources, ad attribution, and campaign performance — feeding data back into the customer pipeline.

---

## How to Resume

Start a new Claude Code session and say:
> "I want to execute the Meta Ads integration plan. The design spec is at `docs/plans/meta-ads-compound-intelligence.md`. Invoke the `executing-plans` skill."

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
