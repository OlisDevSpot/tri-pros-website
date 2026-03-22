# TASKS.md — Tri Pros Task Tracker

Central index of all open, in-progress, and blocked tasks. Each row links to a context file with full details and resumption instructions.

**How to use:** Pick a task, open its context file, and start a Claude session with: _"Continue task: [task name] — context at docs/tasks/[file]"_

---

## 🔴 Ready to Execute

| # | Task | One-liner | Branch | Context |
|---|------|-----------|--------|---------|
| 1 | **Notion CRM Migration** | Remove Notion as the customer source; customers become first-class DB citizens with their own entry flow | `migrating-notion` | [notion-crm-migration.md](./notion-crm-migration.md) |

---

## 🟡 Blocked

| # | Task | One-liner | Blocked By | Context |
|---|------|-----------|-----------|---------|
| 6 | **Pipeline Native Customers** | Add `needs_confirmation` stage, `CreateMeetingModal`, `meetingScopesJSON`, remove dashboard shortcuts | Task #1 must run first | [pipeline-native-customers.md](./pipeline-native-customers.md) |
| 9 | **Meta Ads Integration** | All scripts built, Pixel created, ad account ready — blocked on switching Meta app to Published mode, then run `pnpm meta init-account` | Meta app must be Published at developers.facebook.com | [meta-ads-integration.md](./meta-ads-integration.md) · [handoff](../meta-ads-session-handoff.md) |

---

## 🔵 Partially Done

| # | Task | One-liner | Status | Context |
|---|------|-----------|--------|---------|
| 7 | **Services Pages Redesign** | Pillar pages (energy / luxury) from Notion with ISR — trade-specific service landing pages | Routes + components built; not satisfied with results — needs redesign | [services-pages-redesign.md](./services-pages-redesign.md) |

---

## 🟢 Not Started

| # | Task | One-liner | Context |
|---|------|-----------|---------|
| 8 | **Google Drive Upload Integration** | Agents upload project photos to Google Drive from the showroom editor | [google-drive-upload.md](./google-drive-upload.md) |
| 13 | **Customer File Management System** | Per-customer file browser — MP3 player, document viewer, organized by `tpr-homeowner-files/{customerId}/` R2 structure. Depends on #14 for access control | [customer-file-permissions.md](./customer-file-permissions.md) |
| 14 | **Progressive Agent Permissions** | CASL `CustomerFile` subject, `customer_file_grants` table, presigned URL procedure with grant check, super-admin grant UI. Agents have zero default access — super-admin must explicitly reveal files | [customer-file-permissions.md](./customer-file-permissions.md) |
| 15 | **Portfolio Image Optimization** | Optimize showroom/portfolio photo loading — Next.js `<Image>`, blurDataURL placeholders, responsive sizing, lazy loading. Critical for performance with many project photos | — |
| 16 | **Agent Profile & Settings** | Profile page — update personal settings, view company metadata, useful links, external resources | — |
| 17 | **Super-Admin User Assignment** | Reusable `InternalUserSelect` component with profile cards (avatar + email muted/small under name). Data source: `intakeRouter.getInternalUsers` (extend to return `email`, `image`). Enables super-admins to reassign meeting/proposal ownership. Currently the intake form's `MeetingSchedulerField` has this dropdown — extract + enhance into shared component | — |
| 18 | **Intake Form UX Overhaul** | Three fixes: **(1)** Wrap intake page in `ViewportHero` + `TopSpacer` (hero too close to navbar — match landing page structure from `pillar-view.tsx`). **(2)** Add trade selection (≥1 required) + optional scope picker — reuse existing `TradeScopeRow` pattern (trade `Select` + scope `MultiSelect`) but decouple from `react-hook-form`/`ProjectFormData` since intake uses `useState`. **(3)** Remove internal-user dropdown from external-facing intake forms — that dropdown belongs only in the `MeetingSchedulerField` (which is already conditional on `formConfig.showMeetingScheduler`). Key files: `src/app/(frontend)/(site)/intake/[token]/page.tsx`, `src/features/intake/ui/views/intake-form-view.tsx`, `src/features/intake/ui/components/meeting-scheduler-field.tsx`, `src/features/showroom/ui/components/form/trade-scope-row.tsx` | — |

---

## ✅ Completed

| # | Task | What was done |
|---|------|---------------|
| 2 | **Codebase Quality Remediation** | DAL moved, portfolio merged into showroom, imports fixed, types derived, components extracted |
| 3 | **Cross-Feature Import Rules** | All cross-feature imports go through `index.ts` entrypoints — no internal reaching |
| 4 | **P0 Navigation UX Fixes** | ROOTS routes, button semantics, mounted guard removed, popover close-on-nav, zero hardcoded URLs |
| 5 | **P1 Mobile Gaps** | BaseSheet + ProjectDetailSheet wired; footer uses ROOTS URLs, newsletter removed, typo fixed |
| 10 | **PWA Agent Tool** | `manifest.ts`, splash screen, install prompt, icons, Apple meta tags — all wired in layout |
| 11 | **Multi-Pipeline Customer System** | Schema (pipeline enum + pipelineStage), rehash/dead stage constants, pipeline-config, DAL, tRPC, PipelineSelect UI |
| 12 | **Trade Page Conversion** | TradeSymptomsBand + TradeBeforeAfter components; pain-headlines, symptoms, before-after, benefits constants |

---

## Notes

- Specs: `docs/superpowers/specs/`
- Plans: `docs/superpowers/plans/`
- Task context files (this folder) carry resumption details — TASKS.md is the index only
- Last updated: 2026-03-20
