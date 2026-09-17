// Canonical entity-name constant for the ProjectMediaFile entity. Source of truth
// for `EntityName` and `AppSubject` (see domains/permissions/abilities.ts).
// @migration: media-files DAL is consumed directly by media.service — should eventually go through tRPC entity toolkit
export const PROJECT_MEDIA_FILE = 'ProjectMediaFile' as const
