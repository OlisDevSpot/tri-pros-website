import { ComingSoonState } from '@/shared/components/states/coming-soon-state'

export default function CommunityJoinPage() {
  return (
    <ComingSoonState
      size="page"
      eyebrow="Pardon our dust"
      title={'Joining is\nalmost ready'}
      description="We're building a place for partners and homeowners to plug in. Want a heads-up the moment it's live? Drop your email below — or reach out and we'll talk in the meantime."
      ctaLabel="Notify me"
      homeHref="/contact"
      homeLabel="Talk to us now →"
    />
  )
}
