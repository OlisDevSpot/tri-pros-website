import { motion } from 'motion/react'
import { proposalSections } from '@/features/proposals/constants/proposal-mock-data'
import { useCurrentProposal } from '@/features/proposals/hooks/use-current-proposal'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'

export function ProjectOverview() {
  const proposal = useCurrentProposal()

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
          <div className="space-y-8 lg:px-8 lg:py-6 lg:border rounded-lg ">
            {proposalSections.map(section => (
              <div
                key={section.label}
                className="space-y-4"
              >
                <h4>{section.label}</h4>
                <div className="grid lg:grid-cols-2 gap-2 gap-x-8 w-full">
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
            <p>This project focuses on transforming your existing space into a more functional, energy-efficient, and visually cohesive home that supports how your family lives day to day.</p>
          </div>
          <div>
            <h4>Primary Objectives</h4>
            <p>{`{{ho.motivations}}`}</p>
            <p>{`{{ho.primaryGoals[]}}`}</p>
          </div>
          <div>
            <h4>Home Areas Upgraded</h4>
            <p>{`{{ho.areasImpacted[]}}`}</p>
          </div>
          <div>
            <h4>Efficiency Benefits</h4>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
