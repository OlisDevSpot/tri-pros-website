import Image from 'next/image'
import Link from 'next/link'
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider'
import { PROJECT_TYPES } from '@/features/proposal-flow/constants/project-types'
import { useCurrentProposal } from '@/features/proposal-flow/hooks/use-current-proposal'
import { Logo } from '@/shared/components/logo'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { projectsData } from '@/shared/db/seeds/data/projects'

export function RelatedProjects() {
  const proposal = useCurrentProposal()

  if (proposal.isLoading) {
    return <LoadingState title="Loading Related Projects" description="This might take a few seconds" />
  }

  if (!proposal.data) {
    return null
  }

  const projectType = PROJECT_TYPES[proposal.data.projectType]

  return (
    <Card>
      <CardHeader>
        <div className="w-full flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <CardTitle>
              <h2>
                {`Other ${projectType.title} Projects`}
              </h2>
            </CardTitle>
            <CardDescription>View similar completed projects from our portfolio</CardDescription>
          </div>
          <Button variant="outline">
            <Link href="/portfolio/projects">View Full Portfolio</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="w-full max-h-125 flex flex-col md:flex-row gap-4 overflow-y-auto md:overflow-x-auto pb-4">
          {projectsData.map(project => (
            <Button
              key={project.accessor}
              variant="ghost"
              className="relative group w-full lg:w-75 min-h-100 overflow-hidden z-10 bg-transparent rounded-lg flex items-center justify-center cursor-pointer p-0"
              asChild
            >
              <div>
                <div className="absolute inset-0 select-none z-5">
                  <ReactCompareSlider
                    itemOne={<ReactCompareSliderImage src={`https://pub-06be62a0a47b42cbb944ba281f4df793.r2.dev/${project.title}/hero-before.jpeg`} alt="Before" />}
                    itemTwo={<ReactCompareSliderImage src={`https://pub-06be62a0a47b42cbb944ba281f4df793.r2.dev/${project.title}/hero-after.jpeg`} alt="After" />}
                    className="w-full h-full"
                  />
                  <Image
                    src={`https://pub-06be62a0a47b42cbb944ba281f4df793.r2.dev/${project.title}/hero-after.jpeg`}
                    alt={project.title}
                    fill
                    className="object-cover w-full h-full opacity-100 group-hover:opacity-0 transition duration-300 pointer-events-none"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-80 group-hover:opacity-30 transition duration-300 pointer-events-none" />
                </div>
                <div className="pointer-events-none opacity-100 group-hover:opacity-20 flex flex-col items-center justify-center transition h-full z-20 w-full border-5 border-primary/40 text-wrap relative">
                  <div className="h-fit bg-primary/40 w-full flex flex-col items-center justify-center">
                    <h2 className="uppercase">{project.title}</h2>
                  </div>
                  <div className="absolute bottom-2 right-2 opacity-50">
                    <Logo
                      variant="right"
                      className="h-10 w-30"
                    />
                  </div>
                </div>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
