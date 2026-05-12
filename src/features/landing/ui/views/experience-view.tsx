import { getPublicProjects } from '@/features/landing/dal/server/projects'
import { FeaturedProjects } from '../components/experience/featured-projects'
import { ExperienceHero } from '../components/experience/hero'
import { InquirySection } from '../components/experience/inquiry-section'
import { ServicesGrid } from '../components/experience/services-grid'
import { StatsRow } from '../components/experience/stats-row'
import { StudioStory } from '../components/experience/studio-story'
import { Voices } from '../components/experience/voices'

export async function ExperienceView() {
  const projects = await getPublicProjects()
  const featuredProjects = projects.slice(0, 3)

  return (
    <>
      <ExperienceHero />
      {featuredProjects.length > 0
        ? <FeaturedProjects projects={featuredProjects} />
        : null}
      <StudioStory />
      <Voices />
      <StatsRow />
      <ServicesGrid />
      <InquirySection />
    </>
  )
}
