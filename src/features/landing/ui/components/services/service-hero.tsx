'use client'

import { motion } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ViewportHero } from '@/components/viewport-hero'

export default function ServicesHero() {
  return (
    <ViewportHero>
      {/* Background Img */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/hero-photos/modern-house-5.jpg"
          alt="Tri Pros Remodeling services showcase"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-linear-to-r from-background/70 to-background/50" />
      </div>

      <div className=" flex flex-col lg:flex-row gap-12 lg:gap-24 grid-rows-3 relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="text-foreground space-y-8 mt-16 flex-1"
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
              Complete Construction
              {' '}
              <span className="text-[color-mix(in_oklch,var(--primary)_80%,var(--foreground)_10%)]">Solutions</span>
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-xl leading-relaxed"
          >
            From luxury custom homes to commercial masterpieces, we deliver
            exceptional construction services tailored to your vision and
            budget.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex gap-4 w-full"
          >
            <div className="text-center py-4 border bg-background/70 rounded-sm border-border/50 flex-1 shadow-xl">
              <div className="text-3xl font-bold text-secondary mb-2">4</div>
              <div className="text-sm text-foreground">Core Services</div>
            </div>
            <div className="text-center py-4 border bg-background/70 rounded-sm border-border/30 flex-1 shadow-xl">
              <div className="text-3xl font-bold text-secondary mb-2">
                100+
              </div>
              <div className="text-sm text-foreground">Service Areas</div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="flex flex-row sm:flex-row gap-4 sm:justify-center sm:items-center w-full mx-auto"
          >
            <motion.div className="w-full">
              <Button
                asChild
                size="lg"
                variant="default"
                className="text-lg h-16 w-full"
              >
                <Link href="/contact">Our Team</Link>
              </Button>
            </motion.div>
            <motion.div className="w-full">
              <Button
                asChild
                size="lg"
                variant="outline"
                className="text-lg h-16 w-full"
              >
                <Link href="/portfolio">Our Legacy</Link>
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Service Icons */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="grid grid-cols-2 gap-4 flex-1"
        >
          {[
            {
              icon: '🏠',
              title: 'Custom Homes',
              subtitle: 'Luxury residential',
            },
            {
              icon: '🔨',
              title: 'Renovations',
              subtitle: 'Complete makeovers',
            },
            {
              icon: '🏢',
              title: 'Commercial',
              subtitle: 'Business buildings',
            },
            { icon: '📐', title: 'Design-Build', subtitle: 'Full-service' },
          ].map((service, index) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 + 0.8 }}
              className="bg-foreground/10 backdrop-blur-sm rounded-xl p-6 text-center text-foreground border border-white/20 flex flex-col items-center justify-center"
            >
              <div className="text-4xl mb-3">{service.icon}</div>
              <h3 className="font-bold text-lg mb-1">{service.title}</h3>
              <p className="text-sm text-foreground">{service.subtitle}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </ViewportHero>
  )
}
