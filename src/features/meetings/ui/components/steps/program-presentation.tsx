'use client'

import type { MeetingProgram } from '@/features/meetings/types'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion'
import { Card, CardContent } from '@/shared/components/ui/card'

interface ProgramPresentationProps {
  program: MeetingProgram
}

export function ProgramPresentation({ program }: ProgramPresentationProps) {
  const { presentation } = program

  return (
    <div className="space-y-6">
      {/* Story */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">The Story</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{presentation.story}</p>
      </div>

      {/* History */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Our Background</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{presentation.history}</p>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">What Happens Next</h3>
        <div className="rounded-lg bg-muted/40 px-4 py-3">
          <p className="text-sm text-foreground/80 leading-relaxed">{presentation.timeline}</p>
        </div>
      </div>

      {/* Key stats */}
      {presentation.keyStats.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">By the Numbers</h3>
          <div className="grid grid-cols-3 gap-3">
            {presentation.keyStats.map(stat => (
              <Card className="border-border/60" key={stat.label}>
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground leading-tight">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* FAQs */}
      {presentation.faqs.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Common Questions</h3>
          <Accordion className="w-full" type="multiple">
            {presentation.faqs.map(faq => (
              <AccordionItem key={faq.question} value={faq.question}>
                <AccordionTrigger className="text-sm">{faq.question}</AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}
    </div>
  )
}
