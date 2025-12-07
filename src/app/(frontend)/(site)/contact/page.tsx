import type { Metadata } from 'next'
import ContactHero from '@/features/landing/ui/components/contact/contact-hero'
import ContactInfo from '@/features/landing/ui/components/contact/contact-info'
import ScheduleConsultationForm from '@/features/landing/ui/components/contact/schedule-consultation-form'

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contact Tri Pros Remodeling for your luxury construction project. Schedule a consultation, request a quote, or speak with our expert team today.',
}

export default function ContactPage() {
  return (
    <main className="min-h-screen">
      <ContactHero />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 sticky top-0">
        <section className="bg-background py-16 lg:py-24">
          <ScheduleConsultationForm />
        </section>
        <ContactInfo />
      </div>
    </main>
  )
}
