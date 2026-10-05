import type { AnswerPart, PathTone } from '@/features/calculators/remodel-roi-calculator/types'

export function plain(text: string): AnswerPart {
  return { text }
}

export function emphasis(text: string, tone: PathTone | 'strong' = 'strong'): AnswerPart {
  return { text, tone }
}
