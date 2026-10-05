import type { IntroContent } from '@/features/calculators/remodel-roi-calculator/types'

import { PATH_BAR_CLASSES } from '@/features/calculators/remodel-roi-calculator/constants/story-classes'
import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'
import { cn } from '@/shared/lib/utils'

interface Props {
  intro: IntroContent
}

export function PathsIntro({ intro }: Props) {
  return (
    <div className="grid gap-5">
      <h2 className="max-w-[18ch] font-sans text-4xl font-semibold leading-[1.08] @2xl/story:text-5xl">{intro.title}</h2>
      <p className="max-w-[56ch] text-lg leading-relaxed text-muted-foreground">{intro.body}</p>
      <div className="grid gap-3.5 @2xl/story:grid-cols-2">
        {(['now', 'wait'] as const).map(path => (
          <div className="flex gap-3 rounded-xl border bg-card p-4 shadow-sm" key={path}>
            <span aria-hidden className={cn('w-1 shrink-0 rounded-full', PATH_BAR_CLASSES[path])} />
            <div>
              <b className="font-sans text-base font-semibold">{STORY_COPY.paths[path]}</b>
              <p className="mt-1 text-sm leading-snug text-muted-foreground">{path === 'now' ? intro.now : intro.wait}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
