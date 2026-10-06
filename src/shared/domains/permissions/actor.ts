import type { AppAbility } from './types'

/**
 * Who is acting. Reach comes from `ability`; `userId` only stamps data (author, owner).
 * It is `null` for a share-link holder, for the system and for an anonymous request.
 */
export interface Actor {
  ability: AppAbility
  userId: string | null
}
