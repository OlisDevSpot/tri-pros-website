'use client'

import { motion } from 'motion/react'
import GeneralInquiryForm from '@/features/landing/ui/components/contact/general-inquiry-form'
import ScheduleConsultationForm from '@/features/landing/ui/components/contact/schedule-consultation-form'
import { TopSpacer } from '@/shared/components/top-spacer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { ViewportHero } from '@/shared/components/viewport-hero'

export default function ContactHero() {
  return (
    <ViewportHero className="lg:h-[50vh] max-lg:pb-12 pb-20">
      <TopSpacer>
        <div className="container text-center h-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="h-full"
          >
            <motion.div
              className="flex flex-col lg:flex-row gap-4 lg:gap-20 items-center h-full"
            >
              <div className="flex-1 grow min-h-0 self-start h-full order-2 lg:order-1">
                <Tabs defaultValue="schedule-consultation" className="gap-0 h-full">
                  <div className="h-20 flex items-center justify-center shrink-0">
                    <div className="w-fit flex justify-center">
                      <TabsList>
                        <TabsTrigger value="schedule-consultation">Schedule Consultation</TabsTrigger>
                        <TabsTrigger value="general-inquiry">General Inquiry</TabsTrigger>
                      </TabsList>
                    </div>
                  </div>
                  <div className="w-full grow min-h-0 overflow-auto right-scrollbar">
                    <TabsContent value="schedule-consultation">
                      <ScheduleConsultationForm />
                    </TabsContent>
                    <TabsContent value="general-inquiry">
                      <GeneralInquiryForm />
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
              <div className="flex flex-col flex-1 grow min-h-0 overflow-auto order-1 lg:order-2">
                <h1 className=" text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6">
                  Let&apos;s Build Your
                  {' '}
                  <span className="text-secondary">Dream Project</span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                  Ready to start your luxury construction journey? Contact our expert
                  team for a consultation and discover how we can bring your vision to
                  life.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </TopSpacer>
    </ViewportHero>
  )
}
