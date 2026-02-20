/* eslint-disable react-dom/no-dangerously-set-innerhtml */
import { motion } from 'motion/react'

import { useCurrentProposal } from '@/features/proposal-flow/hooks/use-current-proposal'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { sanitizeUserHtml } from '@/shared/lib/sanitize-html'

export function ScopeOfWork() {
  const proposal = useCurrentProposal()

  if (!proposal) {
    return <ErrorState title="Error: Could not load proposal" description="Please try again" />
  }

  if (proposal.isLoading) {
    return <LoadingState title="Loading Proposal" description="This might take a few seconds" />
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Scope of Work</h2>
          </CardTitle>
          <CardDescription>Ensure your information matches with our records</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div>
            <div>
              {proposal.data.sow?.map(({ title, html }) => (
                <div key={title} className="proposal-sow">
                  <h4>{title}</h4>
                  <div className="space-y-4" dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(html) }} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <div>
              <h3>
                OPTIONAL SCOPE OF WORK
              </h3>
              <p>These go well with the scope of work you have selected. Often, fixed costs will be deducted for combining projects</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
