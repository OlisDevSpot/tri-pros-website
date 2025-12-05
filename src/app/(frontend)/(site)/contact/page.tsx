import ContactForm from '@/features/landing/ui/components/contact/contact-form'
import ContactHero from '@/features/landing/ui/components/contact/contact-hero'
import ContactInfo from '@/features/landing/ui/components/contact/contact-info'

export const metadata = {
  title: 'Contact Tri Pros Remodeling | Schedule Your Consultation',
  description:
    'Contact Tri Pros Remodeling for your luxury construction project. Schedule a consultation, request a quote, or speak with our expert team today.',
}

export default function ContactPage() {
  return (
    <main className="min-h-screen">
      <ContactHero />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 sticky top-0">
        <ContactForm />
        <ContactInfo />
      </div>
    </main>
  )
}
