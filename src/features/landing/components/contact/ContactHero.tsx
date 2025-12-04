'use client'

import { motion } from 'motion/react'
import { HeroContainer } from '@/components/HeroContainer'

export default function ContactHero() {
  return (
    <HeroContainer className="h-[50vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6">
            Let&apos;s Build Your
            {' '}
            <span className="text-secondary">Dream Project</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Ready to start your luxury construction journey? Contact our expert
            team for a consultation and discover how we can bring your vision to
            life.
          </p>
        </motion.div>
      </div>
    </HeroContainer>
  )
}
