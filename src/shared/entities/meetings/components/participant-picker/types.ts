/**
 * Minimal shape parents (e.g. table rows) can pass to `ParticipantPicker`
 * and `ReadOnlyParticipantSummary` as initial owner / co-owner. Used to seed
 * the React Query cache as `placeholderData` (picker) or `initialData`
 * (read-only summary), eliminating the per-row `getParticipants` fetch on
 * table mount.
 *
 * Fields are nullable to mirror the shape returned by `meetings.getAll`'s
 * left joins on the participants table.
 */
export interface InitialParticipantSummary {
  id: string
  userId: string
  userName: string | null
  userEmail: string | null
  userImage: string | null
}
