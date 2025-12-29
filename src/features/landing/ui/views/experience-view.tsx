import { TopSpacer } from '@/shared/components/top-spacer'
import { ViewportHero } from '@/shared/components/viewport-hero'
import { ProcessOverview } from '../components/about/process-overview'
import { ExperienceFeatures } from '../components/experience/features'

export function ExperienceView() {
  return (
    <main className="min-h-screen container">
      <ViewportHero>
        <TopSpacer>
          <div className="flex flex-col lg:flex-row gap-12 items-start lg:items-center h-full">
            <h1 className="text-4xl lg:text-7xl">
              &ldquo;Transparency in every step, customer-first approach, and a skilled team to bring your vision to life.&rdquo;
            </h1>
            <p>
              At Tri Pros Remodeling, our background fuels the way we approach every project. We’re committed to delivering true white-glove service—personalized, attentive, and consistently high-quality. You’ll work with a dedicated representative who oversees each step, making the entire experience smooth, clear, and free of stress.
            </p>
          </div>
        </TopSpacer>
      </ViewportHero>
      <ExperienceFeatures />
      <ProcessOverview />
    </main>
  )
}
