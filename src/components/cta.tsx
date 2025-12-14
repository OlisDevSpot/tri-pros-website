'use client'

import { motion, useInView } from 'motion/react'
import { useRef } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import GeneralInquiryForm from '@/features/landing/ui/components/contact/general-inquiry-form'
import ScheduleConsultationForm from '@/features/landing/ui/components/contact/schedule-consultation-form'

export default function BottomCTA() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.4 }}
      className="text-center mb-32 container"
      ref={ref}
    >
      <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
        Join 500+ satisfied homeowners who chose excellence.
        <span className="font-semibold text-muted-foreground">
          {' '}
          Limited project slots available for 2026.
        </span>
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <Tabs defaultValue="schedule-consultation" className="gap-0 h-full">
          <div className="h-20 flex items-start pb-4 justify-start shrink-0">
            <div className="w-fit flex justify-center">
              <TabsList>
                <TabsTrigger value="schedule-consultation">Schedule Consultation</TabsTrigger>
                <TabsTrigger value="general-inquiry">General Inquiry</TabsTrigger>
              </TabsList>
            </div>
          </div>
          <div className="w-full grow min-h-0 overflow-clip">
            <TabsContent value="schedule-consultation">
              <ScheduleConsultationForm />
            </TabsContent>
            <TabsContent value="general-inquiry">
              <GeneralInquiryForm />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </motion.div>
  )
}
