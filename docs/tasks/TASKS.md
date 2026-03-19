# TASKS.md — Tri Pros Task Tracker

Central index of all open, in-progress, and blocked tasks. Each row links to a context file with full implementation details and resumption instructions.

**How to use:** Pick a task below, open its context file, and start the Claude session with: _"Continue task: [task name] — context at docs/tasks/[file]"_

---

## 🔴 In Progress / Unblocked (ready to execute)

| # | Task | One-liner | Branch | Context |
|---|------|-----------|--------|---------|
| 1 | **Notion CRM Migration** | Remove Notion as the customer source; customers become first-class DB citizens with their own entry flow | `migrating-notion` | [notion-crm-migration.md](./notion-crm-migration.md) |

---

## 🟡 Blocked (waiting on a prerequisite task)

| # | Task | One-liner | Blocked By | Context |
|---|------|-----------|-----------|---------|
| 6 | **Pipeline Native Customers** | Add `needs_confirmation` stage, `CreateMeetingModal`, `meetingScopesJSON`, remove dashboard shortcuts | Task #1 (Notion migration must run first) | [pipeline-native-customers.md](./pipeline-native-customers.md) |

---

## 🟢 Has Plan — Not Started

| # | Task | One-liner | Branch | Context |
|---|------|-----------|--------|---------|
| 7 | **Services Pages Redesign** | Pillar pages from Notion with ISR — trade-specific service landing pages | `main` | [services-pages-redesign.md](./services-pages-redesign.md) |
| 8 | **Google Drive Upload Integration** | Agents can upload project photos to Google Drive from the showroom editor | `main` | [google-drive-upload.md](./google-drive-upload.md) |
| 9 | **Meta Ads Integration** | Scripts + Marketing API to track lead sources and attribution from Meta campaigns | `main` | [meta-ads-integration.md](./meta-ads-integration.md) |
| 10 | **PWA Agent Tool** | Convert app to PWA (Add to Home Screen on iPhone) with splash screen animation | `main` | [pwa-agent-tool.md](./pwa-agent-tool.md) |

---

## 🔵 Partially Done (code merged, plan still has open steps)

| # | Task | One-liner | Status | Context |
|---|------|-----------|--------|---------|
| 11 | **Multi-Pipeline Customer System** | `pipeline` + `pipelineStage` columns + toggle UI — DB changes merged, needs validation | Columns + toggle merged | [multi-pipeline-system.md](./multi-pipeline-system.md) |
| 12 | **Trade Page Conversion** | Convert static trade pages to dynamic DB-driven pages with correct H1/benefits | Partial commits merged | [trade-page-conversion.md](./trade-page-conversion.md) |

---

## ✅ Completed

| # | Task | Completed |
|---|------|-----------|
| 2 | **Codebase Quality Remediation** | All 11 tasks done — DAL moved, portfolio merged, imports fixed, types derived, components extracted |
| 3 | **Cross-Feature Import Rules** | All cross-feature imports go through proper `index.ts` entrypoints — no internal reaching |
| 4 | **P0 Navigation UX Fixes** | All 5 tasks done — ROOTS routes, button semantics, mounted guard removed, popover close-on-nav, zero hardcoded URLs |
| 5 | **P1 Mobile Gaps** | BaseSheet + ProjectDetailSheet wired, footer cleaned (ROOTS URLs, no newsletter, typo fixed) |

---

## Notes

- Specs live in `docs/superpowers/specs/`
- Plans live in `docs/superpowers/plans/`
- This file is the index — task files in `docs/tasks/` carry the resumption context
- Date: 2026-03-19
