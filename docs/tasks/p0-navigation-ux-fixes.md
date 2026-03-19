# Task: P0 Navigation UX Fixes

**Status:** 🔴 READY — high priority, can execute independently
**Branch:** `main`
**Spec:** `docs/superpowers/specs/2026-03-18-p0-navigation-ux-fixes.md`
**Plan:** `docs/superpowers/plans/2026-03-18-p0-navigation-ux-fixes.md`
**Date Planned:** 2026-03-18

---

## One-liner

Fix 4 broken navigation patterns: active link state missing, mobile menu not closing on navigate, scroll not locking behind open menu, and back button breaking in the proposal flow.

---

## How to Resume

Start a new Claude Code session and say:
> "I want to execute the P0 navigation UX fixes plan. The plan is at `docs/superpowers/plans/2026-03-18-p0-navigation-ux-fixes.md`. Invoke the `executing-plans` skill."

---

## Key Changes (summary)

1. **Active nav state** — highlight current route in sidebar/nav
2. **Mobile menu close on navigate** — close sheet/drawer when a link is clicked
3. **Scroll lock** — prevent background scroll when mobile menu is open
4. **Back button in proposal flow** — fix broken browser history navigation

---

## Dependencies

- **Blocks:** Nothing
- **Blocked by:** Nothing
