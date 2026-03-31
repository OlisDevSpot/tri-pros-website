'use client'

import type { FieldWithValues, ProposalOverviewContext } from '@/features/proposal-flow/constants/project-overview-display'
import { motion } from 'motion/react'
import { useCallback } from 'react'
import { proposalFields } from '@/features/proposal-flow/constants/project-overview-display'
import { useCurrentProposal } from '@/features/proposal-flow/hooks/use-current-proposal'
import { SpinnerLoader2 } from '@/shared/components/loaders/spinner-loader-2'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { isTruthy } from '@/shared/types'

export function ProjectOverview() {
  const proposal = useCurrentProposal()

  const generateProposalFields = useCallback(() => {
    if (!proposal.data) {
      return []
    }

    const projectFields = proposal.data.projectJSON.data
    const fundingFields = proposal.data.fundingJSON.data
    const customer = proposal.data.customer

    const proposalCtx: ProposalOverviewContext = {
      name: customer?.name ?? '',
      email: customer?.email ?? '',
      phone: customer?.phone ?? '',
      address: customer?.address ?? '',
      city: customer?.city ?? '',
      state: customer?.state ?? 'CA',
      zip: customer?.zip ?? '',
      ...projectFields,
      ...fundingFields,
      scopes: proposal.data.projectJSON.data.sow.map(sowSection => sowSection.scopes.map(scope => scope.label)).flat().join(', '),
      exclusiveOffers: proposal.data.fundingJSON.data.incentives.filter(inc => inc.type === 'exclusive-offer').map(inc => inc.offer).join(', '),
    }

    return proposalFields.map(section => ({
      ...section,
      fields: section.fields.map((field) => {
        const rawValue = proposalCtx[field.name]

        if (!rawValue || (Array.isArray(rawValue) && rawValue.length === 0)) {
          return undefined
        }

        const fieldWithValue: FieldWithValues<typeof field> = {
          ...field,
          rawValue,
          displayValue: `${rawValue}`,
        }

        if ('format' in field && (field.type === 'enum' || field.type === 'text')) {
          fieldWithValue.displayValue = field.format(String(proposalCtx[field.name] || ''), proposalCtx)
          return fieldWithValue
        }

        return fieldWithValue
      }).filter(isTruthy),
    }))
  }, [proposal.data])

  if (proposal.isLoading) {
    return <LoadingState title="Loading Project Overview" description="This might take a few seconds" />
  }

  if (!proposal.data) {
    return <div className="bg-blue-500">Sorry, nothing to display here</div>
  }

  const { summary, energyBenefits } = proposal.data.projectJSON.data

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <Card>
        <CardHeader className="text-center md:text-start">
          <CardTitle>
            <h2>Project Overview</h2>
          </CardTitle>
          <CardDescription>Ensure your information matches with our records</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-8 rounded-lg ">
            {generateProposalFields().map((section, sectionIndex) => (
              <div
                key={`section-${sectionIndex}`}
                className="flex flex-col md:flex-row gap-6 h-full items-center"
              >
                <div className="flex-1 min-h-0 h-auto w-full grow flex items-center justify-center border rounded-lg py-8 self-stretch">
                  <h2>{section.label}</h2>
                </div>
                <div className="flex-2 flex flex-col gap-2 w-full">
                  {section.fields.map((field, fieldIndex) => (
                    <div
                      key={`field-${fieldIndex}`}
                      className="flex items-start gap-2"
                    >
                      <div className="grow flex items-end gap-2">
                        <div className="flex gap-2 text-muted-foreground">
                          <span className="flex items-center justify-center w-5">
                            {'Icon' in field && <field.Icon className="size-5" />}
                          </span>
                          <p>{field.label}</p>
                        </div>
                        <div className="border-b border-dashed grow mb-1.25" />
                      </div>
                      <span
                        className="w-fit text-end"
                      >
                        {field.displayValue}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {summary && (
            <div>
              <h4>Project Summary</h4>
              {summary ? <p className="text-muted-foreground">{summary}</p> : <SpinnerLoader2 size={16} />}
            </div>
          )}
          {energyBenefits
            && (
              <div>
                <h4>Efficiency Benefits</h4>
                <p className="text-muted-foreground">{energyBenefits}</p>
              </div>
            )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
