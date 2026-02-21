import type { Proposal } from '@/shared/db/schema'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useCallback, useEffect } from 'react'
import { proposalFields } from '@/features/proposal-flow/constants/proposal-fields'
import { useCurrentProposal } from '@/features/proposal-flow/hooks/use-current-proposal'
import { proposalToFormValues } from '@/features/proposal-flow/lib/converters'
import { SpinnerLoader2 } from '@/shared/components/loaders/spinner-loader-2'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { useTRPC } from '@/trpc/helpers'

export function ProjectOverview() {
  const trpc = useTRPC()
  const proposal = useCurrentProposal()
  const proposalForm = proposalToFormValues(proposal.data)
  const aiProjectSummary = useMutation(trpc.aiRouter.generateProjectSummary.mutationOptions())

  useEffect(() => {
    if (!proposal.data?.id)
      return
    if (proposal.data.projectSummary && proposal.data.energyBenefits)
      return

    aiProjectSummary.mutate({
      proposalId: proposal.data.id,
      proposalFormValues: proposalForm,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal.data?.id, proposal.data?.projectSummary])

  const generateProposalFields = useCallback((proposal: Proposal) => {
    return proposalFields.map(section => ({
      ...section,
      overviewFields: section.overviewFields.map((field) => {
        if (field.name === 'name') {
          return {
            ...field,
            value: `${proposal.name}`,
          }
        }

        if ('format' in field && field.type === 'number') {
          return {
            ...field,
            value: field.format(Number(proposal[field.name as keyof Proposal] || '')),
          }
        }

        if ('format' in field && field.type === 'enum') {
          return {
            ...field,
            value: field.format(String(proposal[field.name as keyof Proposal] || '')),
          }
        }

        return {
          ...field,
          value: proposal[field.name as keyof Proposal] || '',
        }
      }),
      extraFields: section.extraFields.map((field) => {
        if (field.name === 'discounts') {
          return {
            ...field,
            value: proposal[field.name as keyof Proposal],
          }
        }

        return {
          ...field,
          value: proposal[field.name as keyof Proposal] || '',
        }
      }),
    }))
  }, [])

  if (proposal.isLoading) {
    return <LoadingState title="Loading Project Overview" description="This might take a few seconds" />
  }

  if (!proposal.data) {
    return <div className="bg-blue-500">Sorry, nothing to display here</div>
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Project Overview</h2>
          </CardTitle>
          <CardDescription>Ensure your information matches with our records</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-8 lg:p-6 lg:border rounded-lg ">
            {generateProposalFields(proposal.data).map(section => (
              <div
                key={section.label}
                className="space-y-4"
              >
                <h4>{section.label}</h4>
                <div className="grid lg:grid-cols-2 gap-2 gap-x-6 w-full">
                  {section.overviewFields.map(field => (
                    <div
                      key={field.label}
                      className="flex items-start lg:items-center gap-2"
                    >
                      <div className="flex gap-2 text-muted-foreground">
                        <span className="flex items-center justify-center w-5">
                          {'Icon' in field && <field.Icon className="size-5" />}
                        </span>
                        <p>{field.label}</p>
                      </div>
                      <div className="border-b border-dashed grow h-[75%]" />
                      {/* <p className="-mt-0.5">{field.value.toString()}</p> */}
                      <p
                        className="w-50"
                      >
                        {field.value.toString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div>
            <h4>Project Summary</h4>
            {proposal.data.projectSummary ? <p className="text-muted-foreground">{proposal.data.projectSummary}</p> : <SpinnerLoader2 size={16} />}
          </div>
          {proposal.data.energyBenefits
            && (
              <div>
                <h4>Efficiency Benefits</h4>
                <p className="text-muted-foreground">{proposal.data.energyBenefits}</p>
              </div>
            )}
          {/* <div>
            <h4>Primary Objectives</h4>
            <p className="text-muted-foreground">{`{{ho.motivations}}`}</p>
            <p className="text-muted-foreground">{`{{ho.primaryGoals[]}}`}</p>
          </div> */}
        </CardContent>
      </Card>
    </motion.div>
  )
}
