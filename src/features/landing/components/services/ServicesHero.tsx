'use client'

import { motion } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { HeroContainer } from '@/components/HeroContainer'
import { Button } from '@/components/ui/button'

export default function ServicesHero() {
  return (
    <HeroContainer>
      {/* Background Img */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/hero-photos/modern-house-5.jpg"
          alt="Tri Pros Remodeling services showcase"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-linear-to-r from-black/70 to-black/40" />
      </div>
    
      <div className="relative z-10 max-w-7xl mx-auto px-4 pt-[calc(var(--header-height)+16px)] sm:px-6 lg:px-8">
        <div className="">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="text-white space-y-8 mt-16"
          >
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                Complete Construction
                {' '}
                <span className="text-secondary">Solutions</span>
              </h1>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-xl text-gray-200 leading-relaxed"
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
              <div className="text-center py-4 border-2 bg-background/70 rounded-sm border-border flex-1">
                <div className="text-3xl font-bold text-secondary mb-2">4</div>
                <div className="text-sm text-gray-300">Core Services</div>
              </div>
              <div className="text-center py-4 border-2 bg-background/70 rounded-sm border-border flex-2">
                <div className="text-3xl font-bold text-secondary mb-2">
                  100+
                </div>
                <div className="text-sm text-gray-300">Service Areas</div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="flex sm:flex-row gap-4"
            >
              <motion.div>
                <Button
                  asChild
                  size="lg"
                  variant="default"
                  className="text-lg h-16"
                >
                  <Link href="/contact">Get Quote</Link>
                </Button>
              </motion.div>
              <motion.div>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="text-lg h-16"
                >
                  <Link href="/portfolio">View Our Work</Link>
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Service Icons */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="grid grid-cols-2 gap-6"
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
                className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center text-white border border-white/20"
              >
                <div className="text-4xl mb-3">{service.icon}</div>
                <h3 className="font-bold text-lg mb-1">{service.title}</h3>
                <p className="text-sm text-gray-300">{service.subtitle}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </HeroContainer>
  )
}
