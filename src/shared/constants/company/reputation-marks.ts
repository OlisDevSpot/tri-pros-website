import type { ReputationMarkData } from '@/shared/components/reputation-mark'
import { reviews } from './reviews'

/** The public review standing, as the marks every surface shows. */
export const REPUTATION_MARKS: ReputationMarkData[] = [
  { kind: 'stars', platform: reviews.google.platform, rating: reviews.google.rating.toFixed(1), count: reviews.google.count, href: reviews.google.url },
  { kind: 'stars', platform: reviews.yelp.platform, rating: reviews.yelp.rating.toFixed(1), count: reviews.yelp.count, href: reviews.yelp.url },
  { kind: 'grade', platform: reviews.bbb.platform, grade: reviews.bbb.rating, href: reviews.bbb.url },
]
