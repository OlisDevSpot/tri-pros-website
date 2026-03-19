# TASKS.md — Tri Pros Task Tracker

Central index of all open, in-progress, and blocked tasks. Each row links to a context file with full implementation details and resumption instructions.

**How to use:** Pick a task below, open its context file, and start the Claude session with: _"Continue task: [task name] — context at docs/tasks/[file]"_

---

## 🔴 In Progress / Unblocked (ready to execute)

| # | Task | One-liner | Branch | Context |
|---|------|-----------|--------|---------|
| 1 | **Notion CRM Migration** | Remove Notion as the customer source; customers become first-class DB citizens with their own entry flow | `migrating-notion` | [notion-crm-migration.md](./notion-crm-migration.md) |

---

## 🟡 Blocked (waiting on a prerequisite)

| # | Task | One-liner | Blocked By | Context |
|---|------|-----------|-----------|---------|
| 6 | **Pipeline Native Customers** | Add `needs_confirmation` stage, `CreateMeetingModal`, `meetingScopesJSON`, remove dashboard shortcuts | Task #1 (Notion migration must run first) | [pipeline-native-customers.md](./pipeline-native-customers.md) |
| 9 | **Meta Ads Integration** | Scripts built; blocked on publishing the Meta app before `pnpm meta init-account` can run | Meta app must be set to Published mode | [meta-ads-integration.md](./meta-ads-integration.md) |

---

## 🔵 Partially Done (code merged, needs rework or completion)

| # | Task | One-liner | Status | Context |
|---|------|-----------|--------|---------|
| 7 | **Services Pages Redesign** | Pillar pages from Notion with ISR — trade-specific service landing pages | Routes + components built, not satisfied with results | [services-pages-redesign.md](./services-pages-redesign.md) |

---

## 🟢 Has Plan — Not Started

| # | Task | One-liner | Branch | Context |
|---|------|-----------|--------|---------|
| 8 | **Google Drive Upload Integration** | Agents can upload project photos to Google Drive from the showroom editor | `main` | [google-drive-upload.md](./google-drive-upload.md) |

---

## ✅ Completed

| # | Task | Completed |
|---|------|-----------|
| 2 | **Codebase Quality Remediation** | All 11 tasks done — DAL moved, portfolio merged, imports fixed, types derived, components extracted |
| 3 | **Cross-Feature Import Rules** | All cross-feature imports go through proper `index.ts` entrypoints — no internal reaching |
| 4 | **P0 Navigation UX Fixes** | All 5 tasks done — ROOTS routes, button semantics, mounted guard removed, popover close-on-nav, zero hardcoded URLs |
| 5 | **P1 Mobile Gaps** | BaseSheet + ProjectDetailSheet wired, footer cleaned (ROOTS URLs, no newsletter, typo fixed) |
| 11 | **Multi-Pipeline Customer System** | Schema + rehash/dead stage constants + pipeline-config + DAL + tRPC + PipelineSelect UI all verified in codebase |
| 10 | **PWA Agent Tool** | manifest, splash screen, install prompt, icons, Apple meta tags — all wired in layout |
| 12 | **Trade Page Conversion** | All new components (TradeSymptomsBand, TradeBeforeAfter) + constants (pain-headlines, symptoms, before-after, benefits) verified in codebase |

---

## Notes

- Specs live in `docs/superpowers/specs/`
- Plans live in `docs/superpowers/plans/`
- This file is the index — task files in `docs/tasks/` carry the resumption context
- Date: 2026-03-19
