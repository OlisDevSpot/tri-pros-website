export const CHAPTER_IDS = ['intro', 'answer', 'today', 'monthly', 'waiting', 'value', 'total', 'basis'] as const

export type ChapterId = typeof CHAPTER_IDS[number]

export const DETAIL_CHAPTER_IDS = ['today', 'monthly', 'waiting', 'value', 'total'] as const satisfies readonly ChapterId[]

export type DetailChapterId = typeof DETAIL_CHAPTER_IDS[number]

export const CHAPTER_RAIL_LABELS = {
  intro: 'Two paths',
  answer: 'The answer',
  today: 'Today',
  monthly: 'Monthly',
  waiting: 'Waiting',
  value: 'Home value',
  total: 'Adding up',
  basis: 'Based on',
} as const satisfies Record<ChapterId, string>

export const CHAPTERS_WITH_INFO = ['answer', ...DETAIL_CHAPTER_IDS] as const satisfies readonly ChapterId[]

export function isDetailChapter(chapter: ChapterId): chapter is DetailChapterId {
  return (DETAIL_CHAPTER_IDS as readonly ChapterId[]).includes(chapter)
}

export function chapterElementId(chapter: ChapterId): string {
  return `roi-chapter-${chapter}`
}

export const INTRO_ONLY = ['intro'] as const satisfies readonly ChapterId[]
