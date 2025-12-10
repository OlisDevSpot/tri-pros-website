import type { Metadata } from 'next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ContactHero from '@/features/landing/ui/components/contact/contact-hero'
import ContactInfo from '@/features/landing/ui/components/contact/contact-info'
import GeneralInquiryForm from '@/features/landing/ui/components/contact/general-inquiry-form'
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
        <section className="relative pb-20">
          <Tabs defaultValue="schedule-consultation" className="gap-0 container max-w-2xl!">
            <div className="h-24 flex items-center pb-4 justify-start">
              <div className="w-fit flex justify-center">
                <TabsList>
                  <TabsTrigger value="schedule-consultation">Schedule Consultation</TabsTrigger>
                  <TabsTrigger value="general-inquiry">General Inquiry</TabsTrigger>
                </TabsList>
              </div>
            </div>
            <TabsContent value="schedule-consultation">
              <ScheduleConsultationForm />
            </TabsContent>
            <TabsContent value="general-inquiry">
              <GeneralInquiryForm />
            </TabsContent>
          </Tabs>
        </section>
        <ContactInfo />
      </div>
    </main>
  )
}
