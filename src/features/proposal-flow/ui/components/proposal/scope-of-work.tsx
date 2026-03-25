/* eslint-disable react-dom/no-dangerously-set-innerhtml */
import { motion } from 'motion/react'

import { useCurrentProposal } from '@/features/proposal-flow/hooks/use-current-proposal'
import { CopySowButton } from '@/features/proposal-flow/ui/components/proposal/copy-sow-button'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/components/ui/accordion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { sanitizeUserHtml } from '@/shared/lib/sanitize-html'

function fmt(n: number) {
  return n.toLocaleString('en-US', { currency: 'USD', maximumFractionDigits: 0, style: 'currency' })
}

export function ScopeOfWork() {
  const proposal = useCurrentProposal()

  if (proposal.isLoading) {
    return <LoadingState title="Loading Proposal" description="This might take a few seconds" />
  }

  if (!proposal.data) {
    return <ErrorState title="Error: Could not load proposal" description="Please try again" />
  }

  const { sow } = proposal.data.projectJSON.data
  const pricingMode = proposal.data.formMetaJSON.pricingMode

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <Card>
        <CardHeader className="text-center md:text-start">
          <CardTitle>
            <h2>Proposed Scope of Work</h2>
          </CardTitle>
          <CardDescription>
            A successful remodeling project always starts with a solid scope of work description.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion
            type="multiple"
            defaultValue={sow.map(s => s.title)}
            className="space-y-3"
          >
            {sow.map((section, index) => (
              <AccordionItem
                key={section.title || index}
                value={section.title || String(index)}
                className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-sm last:border-b"
              >
                <AccordionTrigger className="px-6 py-5 hover:no-underline hover:bg-muted/30 data-[state=open]:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-between w-full mr-3">
                    <div className="flex items-start gap-4">
                      <span className="text-xl font-light text-muted-foreground/40 tabular-nums leading-tight shrink-0 w-6 pt-0.5">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="space-y-1 text-left">
                        <p className="text-base font-semibold leading-snug tracking-tight">
                          {section.title || 'Untitled Section'}
                        </p>
                        {(section.trade.label || section.scopes.length > 0) && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-normal">
                            {section.trade.label && (
                              <span>{section.trade.label}</span>
                            )}
                            {section.trade.label && section.scopes.length > 0 && (
                              <span className="text-muted-foreground/40">·</span>
                            )}
                            {section.scopes.length > 0 && (
                              <span>
                                {section.scopes.length}
                                {' '}
                                {section.scopes.length === 1 ? 'scope' : 'scopes'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {pricingMode === 'breakdown' && (section.price ?? 0) > 0 && (
                      <span className="text-sm font-semibold tabular-nums text-foreground/80 shrink-0">
                        {fmt(section.price!)}
                      </span>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-4">
                  <div className="flex items-start justify-between gap-3 mb-5">
                    {section.scopes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {section.scopes.map(scope => (
                          <span
                            key={scope.id}
                            className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-primary/8 text-primary border border-primary/15"
                          >
                            {scope.label}
                          </span>
                        ))}
                      </div>
                    )}
                    <CopySowButton section={section} />
                  </div>
                  <div
                    className="proposal-sow"
                    dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(section.html) }}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </motion.div>
  )
}
