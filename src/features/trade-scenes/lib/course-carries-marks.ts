import type { CoveringCourseKind } from '@/features/trade-scenes/types'

// Only a tile can be cracked or broken, so only its courses hold a per-piece mark.
export function courseCarriesMarks(course: CoveringCourseKind): boolean {
  return course === 'pan' || course === 'cap'
}
