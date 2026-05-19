// Canonical entity-name constant for the MediaFile entity. Source of truth
// for `EntityName` and `AppSubject` (see domains/permissions/abilities.ts).
// @migration: media-files DAL is consumed directly by media.service — should eventually go through tRPC entity toolkit
export const MEDIA_FILE = 'MediaFile' as const
