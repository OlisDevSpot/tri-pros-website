'use client'

import type { CSSProperties } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useActiveChapter } from '@/features/proposal-flow/contexts/active-chapter-context'
import { useScrollRoot } from '@/features/proposal-flow/contexts/scroll-context'
import { CONTRACTOR_QUESTIONS } from '@/shared/constants/company'
import { useActiveSection } from '@/shared/hooks/use-active-section'
import { ContractorQuestionAside } from './contractor-question-aside'
import { ContractorQuestionChips } from './contractor-question-chips'
import { ContractorQuestionGroup } from './contractor-question-group'

const ANCHOR_IDS = CONTRACTOR_QUESTIONS.map(question => `contractor-q-${question.id}`)

export function ContractorQuestions() {
  const { rootEl } = useScrollRoot()
  const rootRef = useMemo(() => ({ current: rootEl }), [rootEl])
  const chipsRef = useRef<HTMLDivElement>(null)
  const groupsRef = useRef<HTMLDivElement>(null)
  const [chipsHeight, setChipsHeight] = useState(0)
  const questions = useActiveSection(ANCHOR_IDS, { rootEl, offset: chipsHeight, ratio: 0.2 })
  const chapters = useActiveChapter()
  const activeIndex = Math.max(0, ANCHOR_IDS.indexOf(questions.activeId))

  // The chips hide on laptop; a hidden strip measures 0, so the tracker and the scroll margin drop it too.
  useEffect(() => {
    const chips = chipsRef.current
    if (!chips) {
      return
    }
    const observer = new ResizeObserver(() => setChipsHeight(chips.offsetHeight))
    observer.observe(chips)
    return () => observer.disconnect()
  }, [])

  // Both trackers hold their mark through the jump: the question here, and the Contractor tab in the top bar.
  const { select: selectQuestion } = questions
  const { select: selectChapter } = chapters
  const select = useCallback((index: number) => {
    const id = ANCHOR_IDS[index]
    if (!id) {
      return
    }
    selectQuestion(id)
    selectChapter(id)
  }, [selectQuestion, selectChapter])

  return (
    <div
      style={{ '--chips-h': `${chipsHeight}px` } as CSSProperties}
      className="grid grid-cols-[minmax(0,1fr)] gap-5 @min-[1100px]/proposal:grid-cols-[300px_minmax(0,1fr)] @min-[1100px]/proposal:items-start @min-[1100px]/proposal:gap-10"
    >
      <ContractorQuestionChips ref={chipsRef} activeIndex={activeIndex} onSelect={select} root={rootRef} groupsRef={groupsRef} />
      <ContractorQuestionAside activeIndex={activeIndex} onSelect={select} />
      <div ref={groupsRef} className="grid gap-8 @min-[1100px]/proposal:gap-10 @min-[1100px]/proposal:pt-2 @min-[1100px]/proposal:pb-[30%]">
        {CONTRACTOR_QUESTIONS.map((question, i) => (
          <ContractorQuestionGroup
            key={question.id}
            question={question}
            number={i + 1}
            anchorId={ANCHOR_IDS[i]!}
            active={i === activeIndex}
            rootRef={rootRef}
          />
        ))}
      </div>
    </div>
  )
}
