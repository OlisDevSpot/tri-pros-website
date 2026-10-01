/**
 * The owner / co-owner a parent (e.g. a table row) already loaded, passed to `ParticipantPicker` and
 * `ReadOnlyParticipantSummary` so neither fetches `getParticipants` per row: the picker shows it until it
 * opens, the summary seeds the cache with it as `initialData`.
 *
 * Fields are nullable to mirror the list query's left joins on the participants table.
 */
export interface InitialParticipantSummary {
  id: string
  userId: string
  userName: string | null
  userEmail: string | null
  userImage: string | null
}
