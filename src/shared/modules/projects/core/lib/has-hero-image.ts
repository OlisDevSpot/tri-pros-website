import type { PortfolioProject, PortfolioProjectWithHero } from '@/shared/modules/projects/core/types'

export function hasHeroImage(row: PortfolioProject): row is PortfolioProjectWithHero {
  return row.heroImage !== null
}
