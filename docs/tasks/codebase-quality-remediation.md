# Task: Codebase Quality Remediation

**Status:** ✅ COMPLETE — verified 2026-03-19
**Branch:** `main`
**Spec:** _(no separate spec — plan is self-contained)_
**Plan:** `docs/superpowers/plans/2026-03-17-codebase-quality-remediation.md`
**Date Planned:** 2026-03-17

---

## One-liner

Fix import violations across the codebase, merge the `portfolio` feature into `showroom`, and enforce feature boundary rules before they compound further.

---

## How to Resume

Start a new Claude Code session and say:
> "I want to execute the codebase quality remediation plan. The plan is at `docs/superpowers/plans/2026-03-17-codebase-quality-remediation.md`. Invoke the `executing-plans` skill."

---

## Key Changes (summary)

- Merge `portfolio` feature into `showroom` — they're the same domain
- Fix `features/` → `features/` direct imports (must go through public entrypoints)
- Fix `shared/` importing from `features/`
- Clean up any barrel file violations in `ui/components/`, `constants/`, `lib/`, etc.

---

## Dependencies

- **Blocks:** Nothing specific, but resolving this reduces future tech debt for all other tasks
- **Blocked by:** Nothing
