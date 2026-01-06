import { projectTypes } from '@/features/proposal-flow/constants/project-types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'

export function RelatedProjects() {
  const projectType = projectTypes['energy-efficient']

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>
            {`Other ${projectType.title} Projects`}
          </h2>
        </CardTitle>
        <CardDescription>View similar completed projects from our portfolio</CardDescription>
      </CardHeader>
      <CardContent>
        <div></div>
      </CardContent>
    </Card>
  )
}
