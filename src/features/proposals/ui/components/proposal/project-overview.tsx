import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function ProjectOverview() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>
            Project Overview
          </h2>
        </CardTitle>
        <CardDescription>Let's see our upcoming work in a snapshot</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div>
          <p>PROJECT SUMMARY</p>
          <p>This project focuses on transforming your existing space into a more functional, energy-efficient, and visually cohesive home that supports how your family lives day to day.</p>
        </div>
        <div>
          <p>PRIMARY OBJECTIVES</p>
          <p>{`{{ho.motivations}}`}</p>
          <p>{`{{ho.primaryGoals[]}}`}</p>
        </div>
        <div>
          <p>AREAS IMPACTED</p>
          <p>{`{{ho.areasImpacted[]}}`}</p>
          <p>Front-yard</p>
          <p>Side-yard</p>
          <p>Front porch</p>
        </div>
        <div>
          <p>EFFICIENCY BENEFITS</p>
        </div>
        <div>
          <p>PROJECT TIMELINE</p>
        </div>
      </CardContent>
    </Card>
  )
}
