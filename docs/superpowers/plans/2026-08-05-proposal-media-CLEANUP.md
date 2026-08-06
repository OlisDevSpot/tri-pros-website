# Proposal Media Subsystem — Deprecated Portfolio Cluster CLEANUP

**Created:** 2026-08-05 (Task D2)

The project photo manager was ported onto the shared `src/shared/components/media/*`
primitives as `ProjectMediaManager`. The old `portfolio/*` photo-manager cluster and the
old project-specific upload hook are now **deprecated-in-place** (JSDoc `@deprecated`
banners) but still compile — `sortable-media-manager.tsx` still imports the other portfolio
files, so the whole cluster is dead-but-present with no non-deprecated importers.

## Gate

> **Delete all of the files below once the project-photos manual parity check
> (upload / optimize / reorder / hero / phase / rename / delete / bulk / retry / Drive)
> confirms the new `ProjectMediaManager` behaves identically.**
>
> Deleting them together is safe — after Task D2 they have no non-deprecated importers.

## Files to delete (with their replacements)

| Deprecated file | Replacement |
| --- | --- |
| `src/shared/components/portfolio/sortable-media-manager.tsx` | `src/features/project-management/ui/components/form/project-media-manager.tsx` + `src/shared/components/media/*` |
| `src/shared/components/portfolio/sortable-photo-card.tsx` | `src/shared/components/media/media-card.tsx` |
| `src/shared/components/portfolio/upload-source-popover.tsx` | `src/shared/components/media/media-upload-button.tsx` |
| `src/shared/components/portfolio/photo-detail-dialog.tsx` | `src/shared/components/media/photo-detail-dialog.tsx` |
| `src/shared/hooks/use-media-upload.ts` | `src/shared/components/media/use-media-upload.ts` |

## Deletion procedure (post-parity)

1. Confirm parity check passed.
2. Delete the five files above.
3. `grep -rn "SortableMediaManager\|SortablePhotoCard\|UploadSourcePopover" src` — expect no hits.
4. `grep -rn "shared/hooks/use-media-upload\|shared/components/portfolio/photo-detail-dialog" src` — expect no hits.
5. `pnpm tsc` + `pnpm lint` → clean.
