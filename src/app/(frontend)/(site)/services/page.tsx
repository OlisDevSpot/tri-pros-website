import BottomCTA from '@/components/BottomCTA'
import ProcessOverview from '@/features/landing/components/about/ProcessOverview'
import ServicesHero from '@/features/landing/components/services/ServicesHero'
import ServicesList from '@/features/landing/components/services/ServicesList'
import ServicesListScroll from '@/features/landing/components/services/ServicesListScroll'

export const metadata = {
  title: 'Construction Services | Elite Construction Company',
  description:
    'Comprehensive construction services including custom homes, luxury renovations, commercial projects, and design-build services. View our complete service portfolio and pricing.',
}

export default function ServicesPage() {
  return (
    <main className="h-full">
      <ServicesHero />
      {/* <ServicesListScroll /> */}
      {/* <ServicesList /> */}
      <ProcessOverview />
      <BottomCTA />
    </main>
  )
}
