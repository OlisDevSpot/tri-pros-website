import { getPublicProjects } from '@/features/landing/dal/server/projects'
import { buildProjectStorySlides } from '@/features/landing/lib/experience-project-stories'
import { GrainOverlay } from '../components/experience/grain-overlay'
import { ExperienceHero } from '../components/experience/hero'
import { InquirySection } from '../components/experience/inquiry-section'
import { ProjectStories } from '../components/experience/project-stories'
import { ServicesGrid } from '../components/experience/services-grid'
import { StatsRow } from '../components/experience/stats-row'
import { StudioStory } from '../components/experience/studio-story'

export async function ExperienceView() {
  const projects = await getPublicProjects()
  const slides = buildProjectStorySlides(projects)

  return (
    <>
      <GrainOverlay />
      <ExperienceHero />
      {slides.length > 0 ? <ProjectStories slides={slides} /> : null}
      <StudioStory />
      <StatsRow />
      <ServicesGrid />
      <InquirySection />
    </>
  )
}
