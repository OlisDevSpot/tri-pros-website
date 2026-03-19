# Task: Notion CRM Migration

**Status:** 🔴 READY — unblocked, execute first before pipeline-native-customers
**Branch:** `migrating-notion`
**Spec:** `docs/superpowers/specs/2026-03-19-notion-crm-migration-design.md`
**Plan:** `docs/superpowers/plans/2026-03-19-notion-crm-migration.md`
**Date Planned:** 2026-03-19

---

## One-liner

Replace Notion as the source of customer contacts — customers become first-class DB citizens with their own creation flow, removing the Notion contact search from meeting creation.

---

## How to Resume

Start a new Claude Code session and say:
> "I want to execute the Notion CRM migration plan. The plan is at `docs/superpowers/plans/2026-03-19-notion-crm-migration.md`. Invoke the `executing-plans` skill and let's get started."

---

## Why This Is First

Every other feature that touches meetings or customers depends on customers being native DB citizens. The `CreateMeetingModal` (from the pipeline-native-customers task) passes `customerId` directly — it cannot work until Notion contacts are no longer the source of truth.

---

## Key Changes (summary from plan)

- Add `customers` table to PostgreSQL schema
- Remove `notionContactId` from meetings `create` procedure
- Replace Notion contact search in meeting creation with native customer lookup/creation
- Migrate any existing meeting-to-notion-contact links to customer records
- Remove Notion service calls from the meetings flow

---

## Dependencies

- **Blocks:** Task #6 — Pipeline Native Customers
- **Blocked by:** Nothing
