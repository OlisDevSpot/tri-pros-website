'use client'

import { CONTRACTOR_QUESTIONS } from '@/shared/constants/company'
import { cn } from '@/shared/lib/utils'

interface Props {
  activeIndex: number
  onSelect: (index: number) => void
}

export function ContractorQuestionAside({ activeIndex, onSelect }: Props) {
  return (
    <aside aria-label="Questions" className="sticky top-10 hidden gap-5.5 @min-[1100px]/proposal:grid">
      <p className="text-sm text-muted-foreground">
        {'Question '}
        <b className="text-foreground">{activeIndex + 1}</b>
        {` of ${CONTRACTOR_QUESTIONS.length}`}
      </p>
      <div className="grid">
        {CONTRACTOR_QUESTIONS.map((question, i) => (
          <p
            key={question.id}
            aria-hidden={i !== activeIndex}
            className={cn(
              'col-start-1 row-start-1 font-sans text-3xl leading-[1.15] font-medium text-balance transition-[opacity,translate] duration-180 ease-out motion-reduce:transition-none',
              i === activeIndex ? 'opacity-100' : 'translate-y-2 opacity-0',
            )}
          >
            {question.title}
          </p>
        ))}
      </div>
      <ol className="grid gap-0.5 border-l-2 border-border">
        {CONTRACTOR_QUESTIONS.map((question, i) => (
          <li key={question.id}>
            <button
              type="button"
              onClick={() => onSelect(i)}
              aria-current={i === activeIndex ? 'true' : undefined}
              className={cn(
                '-ml-0.5 flex w-full items-center gap-2.5 border-l-2 border-transparent px-3.5 py-2.25 text-left text-sm leading-snug font-bold text-muted-foreground transition-colors hover:text-foreground',
                i === activeIndex && 'border-l-primary text-foreground',
              )}
            >
              <span className="font-sans text-xs font-semibold">{i + 1}</span>
              {question.title}
            </button>
          </li>
        ))}
      </ol>
    </aside>
  )
}
