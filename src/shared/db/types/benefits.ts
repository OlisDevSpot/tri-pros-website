import type { benefitCategoriesData } from '@/shared/db/seeds/data/benefit-categories'
import type { benefitsData } from '@/shared/db/seeds/data/benefits'

export type BenefitCategoryAccessor = typeof benefitCategoriesData[number]['accessor']
export type BenefitAccessor = typeof benefitsData[keyof typeof benefitsData][number]['accessor']

export type BenefitsOfCategory<T extends BenefitCategoryAccessor> = typeof benefitsData[T][number]['accessor']
