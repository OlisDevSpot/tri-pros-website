import { ComingSoonState } from '@/shared/components/states/coming-soon-state'

export default function PortfolioTestimonialsPage() {
  return (
    <ComingSoonState
      size="page"
      eyebrow="Pardon our dust"
      title={'Testimonials are\nbeing polished'}
      description="We're gathering stories from our most recent kitchen, bath, and ADU projects. Until they're move-in ready, take a tour of the finished work."
      homeHref="/portfolio/projects"
      homeLabel="See finished projects →"
    />
  )
}
