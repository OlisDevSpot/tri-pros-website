import { ViewportHero } from '@/components/viewport-hero'
import { TopSpacer } from '../components/about/about-hero'

export function ExperienceView() {
  return (
    <ViewportHero>
      <TopSpacer>
        <div className="container w-full h-full flex gap-12">
          <h1>
            Count on an experience that runs smoothly from start to finish—steady communication, dependable follow-through, and a team that handles everything.
          </h1>
          <p>
            At Tri Pros Remodeling, our background fuels the way we approach every project. We’re committed to delivering true white-glove service—personalized, attentive, and consistently high-quality. You’ll work with a dedicated representative who oversees each step, making the entire experience smooth, clear, and free of stress.
          </p>
        </div>
      </TopSpacer>
    </ViewportHero>
  )
}
