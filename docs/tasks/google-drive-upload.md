# Task: Google Drive Upload Integration

**Status:** 🟢 HAS PLAN — not started
**Branch:** `main`
**Spec:** `docs/superpowers/specs/2026-03-18-google-drive-upload-design.md`
**Plan:** `docs/superpowers/plans/2026-03-18-google-drive-upload.md`
**Date Planned:** 2026-03-18

---

## One-liner

Let agents upload project photos directly to Google Drive from the showroom editor, instead of uploading to R2 manually.

---

## How to Resume

Start a new Claude Code session and say:
> "I want to execute the Google Drive upload integration plan. The plan is at `docs/superpowers/plans/2026-03-18-google-drive-upload.md`. Invoke the `executing-plans` skill."

---

## Key Changes (summary)

- Google Drive OAuth integration (service account or user OAuth)
- File upload UI in showroom editor
- Drive API calls for folder creation + file upload
- Link Drive files to project media records in DB

---

## Dependencies

- **Blocks:** Nothing
- **Blocked by:** Nothing
