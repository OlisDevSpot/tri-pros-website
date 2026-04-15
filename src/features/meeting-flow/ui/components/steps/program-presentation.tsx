'use client'

import type { MeetingProgram } from '@/features/meeting-flow/types'
import { BookOpenIcon, CalendarIcon, HistoryIcon, MessageCircleQuestionIcon } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion'

interface ProgramPresentationProps {
  program: MeetingProgram
}

export function ProgramPresentation({ program }: ProgramPresentationProps) {
  const { presentation } = program

  return (
    <div className="space-y-8">
      {/* Story */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpenIcon className="size-4 text-primary/70" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">The Story</h3>
        </div>
        <div className="rounded-2xl border border-border/40 bg-card/50 px-6 py-5">
          <p className="text-[15px] leading-relaxed text-foreground/85">
            {presentation.story}
          </p>
        </div>
      </div>

      {/* History */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <HistoryIcon className="size-4 text-primary/70" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Our Background</h3>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {presentation.history}
        </p>
      </div>

      {/* Key Stats */}
      {presentation.keyStats.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {presentation.keyStats.map(stat => (
            <div
              key={stat.label}
              className="flex flex-col items-center gap-1 rounded-xl border border-border/40 bg-card/50 px-4 py-4 text-center shadow-sm"
            >
              <span className="text-lg font-bold tabular-nums tracking-tight text-foreground">
                {stat.value}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="size-4 text-primary/70" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">What Happens Next</h3>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
          <p className="text-sm leading-relaxed text-foreground/80">
            {presentation.timeline}
          </p>
        </div>
      </div>

      {/* FAQs */}
      {presentation.faqs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MessageCircleQuestionIcon className="size-4 text-primary/70" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Common Questions</h3>
          </div>
          <Accordion className="w-full space-y-2" type="multiple">
            {presentation.faqs.map(faq => (
              <AccordionItem
                key={faq.question}
                value={faq.question}
                className="overflow-hidden rounded-xl border border-border/40 bg-card/50 shadow-sm last:border-b"
              >
                <AccordionTrigger className="px-5 py-3.5 text-sm font-medium hover:no-underline hover:bg-muted/30 data-[state=open]:bg-muted/20">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-4 pt-1">
                  <p className="text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}
    </div>
  )
}
