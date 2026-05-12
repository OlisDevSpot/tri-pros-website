'use client'

import { motion, useInView } from 'motion/react'
import { useRef } from 'react'
import { SECTION_ENTRANCE, VIEWPORT_MARGIN } from '@/features/landing/constants/experience-motion'
import { GeneralInquiryForm } from '@/features/landing/ui/components/forms/general-inquiry-form'
import { contactInfo } from '@/shared/constants/company/contact-info'
import { socials } from '@/shared/constants/company/socials'
import { EditorialEyebrow } from './editorial-eyebrow'

export function InquirySection() {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: VIEWPORT_MARGIN })

  return (
    <section ref={ref} id="inquiry" className="py-20 lg:py-32 scroll-mt-24">
      <div className="container">
        <motion.div
          variants={SECTION_ENTRANCE}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="text-center mb-12 lg:mb-16 space-y-5 flex flex-col items-center"
        >
          <EditorialEyebrow>Start the Conversation</EditorialEyebrow>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl leading-[1.1] tracking-[-0.01em] text-foreground max-w-3xl">
            Let&apos;s build something
            {' '}
            <em className="italic text-primary">exceptional</em>
            .
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          <div className="lg:col-span-7">
            <GeneralInquiryForm />
          </div>

          <aside className="lg:col-span-5 lg:sticky lg:top-24 space-y-8 p-8 lg:p-10 border border-foreground/10 bg-foreground/[0.02]">
            <EditorialEyebrow>Reach Us Directly</EditorialEyebrow>

            <ul className="space-y-6">
              {contactInfo.map(info => (
                <li key={info.accessor} className="space-y-1">
                  <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                    {info.label}
                  </div>
                  <div className="font-serif text-lg lg:text-xl text-foreground whitespace-pre-line">
                    {info.value}
                  </div>
                </li>
              ))}
            </ul>

            <hr className="border-t border-foreground/10" />

            <div className="flex items-center gap-5">
              {socials.map((s) => {
                const Icon = s.Icon
                return (
                  <a
                    key={s.name}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Tri Pros on ${s.name}`}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Icon className="size-5" />
                  </a>
                )
              })}
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
