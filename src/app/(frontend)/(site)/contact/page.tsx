import type { Metadata } from 'next'
import ContactHero from '@/features/landing/ui/components/contact/contact-hero'
import ContactInfo from '@/features/landing/ui/components/contact/contact-info'

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contact Tri Pros Remodeling for your luxury construction project. Schedule a consultation, request a quote, or speak with our expert team today.',
}

export default function ContactPage() {
  return (
    <main className="min-h-screen">
      <ContactHero />
      <div className="flex flex-col lg:flex-row sticky top-0">
        <ContactInfo />
      </div>
    </main>
  )
}
