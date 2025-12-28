import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  projectType: 'energy-efficient' | 'general remodeling'
}

export const projectTypes = {
  'energy-efficient': {
    title: 'Energy Efficient',
    description: 'Energy efficient projects',
  },
  'general remodeling': {
    title: 'General Remodeling',
    description: 'General remodeling projects',
  },
}

export function RelatedProjects({ projectType }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {`Other ${projectTypes[projectType].title} Projects`}
        </CardTitle>
        <CardDescription>View similar completed projects from our portfolio</CardDescription>
      </CardHeader>
      <CardContent>
        <div></div>
      </CardContent>
    </Card>
  )
}
