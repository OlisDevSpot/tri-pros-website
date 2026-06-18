import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import type { FunnelSpec } from '@/shared/domains/funnels/types'
import { bathroomsFunnel } from '@/shared/domains/funnels/constants/bathrooms'
import { completeInteriorFunnel } from '@/shared/domains/funnels/constants/complete-interior'
import { kitchensFunnel } from '@/shared/domains/funnels/constants/kitchens'

/**
 * Centralized slug → spec resolution. A static, exhaustive Record (not a
 * load-time register() side-effect): completeness is guaranteed at compile
 * time — omit a slug and tsc errors here. See the foundation plan.
 */
const FUNNELS: Record<FunnelSlug, FunnelSpec> = {
  'kitchens': kitchensFunnel,
  'bathrooms': bathroomsFunnel,
  'complete-interior': completeInteriorFunnel,
}

export function getFunnel(slug: FunnelSlug): FunnelSpec {
  return FUNNELS[slug]
}
