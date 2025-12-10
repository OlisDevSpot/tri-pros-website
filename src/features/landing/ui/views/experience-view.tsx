import { TopSpacer } from '@/components/top-spacer'
import { ViewportHero } from '@/components/viewport-hero'

export function ExperienceView() {
  return (
    <ViewportHero>
      <TopSpacer>
        <div className="flex flex-col lg:flex-row gap-12 items-start lg:items-center h-full">
          <div className="container w-full h-full flex flex-col gap-4">
            <h1>
              &ldquo;Transparency in every step, steady communication from start to finish, and a team that handles everything.&rdquo;
            </h1>
            <p>
              At Tri Pros Remodeling, our background fuels the way we approach every project. We’re committed to delivering true white-glove service—personalized, attentive, and consistently high-quality. You’ll work with a dedicated representative who oversees each step, making the entire experience smooth, clear, and free of stress.
            </p>
          </div>
        </div>
      </TopSpacer>
    </ViewportHero>
  )
}
