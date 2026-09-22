import type { PresentationGroup, PresentationSlide } from '@/shared/components/presentation/types'

/**
 * Groups slides for layout. A `full` slide stands alone; consecutive `column` slides form one
 * run that shares a sticky heading column (C37). `frame` defaults to `'column'` here and
 * nowhere else (L2): every item carries the resolved frame. See ./DOCS.md#runs
 */
export function groupSlides<TContent>(slides: PresentationSlide<TContent>[]): PresentationGroup<TContent>[] {
  const groups: PresentationGroup<TContent>[] = []
  for (const [index, slide] of slides.entries()) {
    const frame = slide.frame ?? 'column'
    const item = { slide, index, frame }
    if (frame === 'full') {
      groups.push({ kind: 'full', item })
      continue
    }
    const last = groups.at(-1)
    if (last?.kind === 'run') {
      last.items.push(item)
      continue
    }
    groups.push({ kind: 'run', items: [item] })
  }
  return groups
}
