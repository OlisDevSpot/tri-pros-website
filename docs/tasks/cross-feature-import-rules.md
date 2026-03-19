# Task: Cross-Feature Import Rules

**Status:** ✅ COMPLETE — verified 2026-03-19
**Branch:** `main`
**Spec:** `docs/superpowers/specs/2026-03-17-cross-feature-import-rules-design.md`
**Plan:** `docs/superpowers/plans/2026-03-17-cross-feature-import-rules.md`
**Date Planned:** 2026-03-17

---

## One-liner

Add ESLint rules or path alias guards to enforce that features only consume each other through public entrypoints (`ui/views/index.ts`, `ui/components/index.ts`, `lib/index.ts`) — no reaching into internals.

---

## How to Resume

Start a new Claude Code session and say:
> "I want to execute the cross-feature import rules plan. The plan is at `docs/superpowers/plans/2026-03-17-cross-feature-import-rules.md`. Invoke the `executing-plans` skill."

---

## Key Changes (summary)

- Define public entrypoints for each feature (`index.ts` barrel exports at feature root)
- Add ESLint `import/no-restricted-paths` rules to block direct internal access
- Fix any existing violations found during rule implementation

---

## Dependencies

- **Blocks:** Nothing
- **Blocked by:** Nothing (but best done alongside or after codebase-quality-remediation)
