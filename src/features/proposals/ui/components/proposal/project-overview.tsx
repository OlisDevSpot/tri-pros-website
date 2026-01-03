import type { ContactProperties } from '@/shared/services/hubspot/types/contacts'
import { motion } from 'motion/react'
import { useCallback } from 'react'
import { proposalFields } from '@/features/proposals/constants/proposal-fields'
import { useCurrentProposal } from '@/features/proposals/hooks/use-current-proposal'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { useHubspotContact } from '@/shared/services/hubspot/hooks/useHubspot'

export function ProjectOverview() {
  const proposal = useCurrentProposal()
  const contact = useHubspotContact({ contactId: proposal.data?.hubspotContactVid || '', enabled: !!proposal.data?.hubspotContactVid })

  const generateProposalFields = useCallback((properties: ContactProperties) => {
    return proposalFields.map(section => ({
      ...section,
      overviewFields: section.overviewFields.map((field) => {
        if (field.name === 'name') {
          return {
            ...field,
            value: `${properties.firstname} ${properties.lastname}`,
          }
        }

        if ('format' in field && field.type === 'number') {
          return {
            ...field,
            value: field.format(Number(properties[field.name as keyof ContactProperties] || proposal.data?.[field.name as keyof typeof proposal.data] || '')),
          }
        }

        if ('format' in field && field.type === 'enum') {
          return {
            ...field,
            value: field.format(String(properties[field.name as keyof ContactProperties] || proposal.data?.[field.name as keyof typeof proposal.data] || '')),
          }
        }

        return {
          ...field,
          value: properties[field.name as keyof ContactProperties] || proposal.data?.[field.name as keyof typeof proposal.data] || '',
        }
      }),
    }))
  }, [proposal])

  if (contact.isLoading) {
    return <div>Sorry, nothing to display here</div>
  }

  if (!contact.data) {
    return <div>Sorry, nothing to display here</div>
  }

  const { properties } = contact.data

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
            {generateProposalFields(properties).map(section => (
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
                      <p className="-mt-0.5">{field.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div>
            <h4>Project Summary</h4>
            <p className="text-muted-foreground">This project focuses on transforming your existing space into a more functional, energy-efficient, and visually cohesive home that supports how your family lives day to day.</p>
          </div>
          <div>
            <h4>Primary Objectives</h4>
            <p className="text-muted-foreground">{`{{ho.motivations}}`}</p>
            <p className="text-muted-foreground">{`{{ho.primaryGoals[]}}`}</p>
          </div>
          <div>
            <h4>Home Areas Upgraded</h4>
            <p className="text-muted-foreground">{`{{ho.areasImpacted[]}}`}</p>
          </div>
          <div>
            <h4>Efficiency Benefits</h4>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
