import type { ShowcaseMedia, ShowcaseProjectIndex } from '@/features/meeting-flow/types'
import type { ScopeOrAddon } from '@/shared/modules/construction/sources/notion/scopes/schema'
import { SCOPE_PHOTOS } from '@/features/meeting-flow/constants/trade-photos'
import { curatedMedia, projectMedia } from '@/features/meeting-flow/lib/to-showcase-media'

/** A scope's curated photo, else its first tagged portfolio project; null when it has neither. */
export function selectScopeMedia(scope: ScopeOrAddon, index: ShowcaseProjectIndex): ShowcaseMedia | null {
  const photo = SCOPE_PHOTOS[scope.name]
  if (photo) {
    return curatedMedia(photo)
  }
  const project = index.byScope.get(scope.id)?.[0]
  return project ? projectMedia(project) : null
}
