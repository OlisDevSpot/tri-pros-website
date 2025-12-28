import { motion } from 'motion/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { proposalSections } from '@/features/proposals/constants/proposal-mock-data'

export function ProjectOverview() {
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
          <div className="space-y-8">
            {proposalSections.map(section => (
              <div
                key={section.label}
                className="space-y-4"
              >
                <h4>{section.label}</h4>
                <div className="grid lg:grid-cols-2 gap-2 w-full">
                  {section.overviewFields.map(field => (
                    <div
                      key={field.label}
                      className="flex items-center gap-2"
                    >
                      {'Icon' in field && <field.Icon className="w-5 h-5 text-muted-foreground" />}
                      <p className="">{field.value}</p>
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
