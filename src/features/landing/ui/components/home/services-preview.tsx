'use client'

import { motion, useInView } from 'motion/react'

import Image from 'next/image'
import Link from 'next/link'
import { useRef } from 'react'
import DecorativeLine from '@/components/decorative-line'
import { Button } from '@/components/ui/button'
import { services } from '@/features/landing/data/company/services'

export default function ServicesPreview() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section
      ref={ref}
      style={{
        background: 'radial-gradient(circle at top , color-mix(in oklab, var(--background) 100%, transparent), color-mix(in oklab, var(--primary) 20%, transparent))',
      }}
      className="relative py-20 lg:py-32"
    >
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className=" text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Our Premium
            {' '}
            <span className="text-primary">Services</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            From custom luxury homes to commercial masterpieces, we deliver
            exceptional results across all construction disciplines.
          </p>
          <DecorativeLine
            animate={isInView ? { width: '200px' } : { width: 0 }}
            transition={{ duration: 1, delay: 0.5 }}
          />
        </motion.div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {services.map((service, index) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 50 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              className="group"
            >
              <Link href={service.href}>
                <motion.div
                  whileHover={{ y: -5 }}
                  transition={{ duration: 0.3 }}
                  className="bg-card rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 border border-border/50 h-full flex flex-col"
                >
                  {/* Image */}
                  <div className="relative overflow-hidden group/image">
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.4 }}
                    >
                      <Image
                        src={service.image}
                        alt={service.title}
                        width={600}
                        height={400}
                        className="w-full h-64 object-cover"
                      />
                    </motion.div>
                    <div className="absolute inset-0 bg-linear-to-t from-card/50 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300" />

                    {/* Overlay CTA */}
                    <div className="absolute bottom-4 left-4 right-4 opacity-0 group-hover/image:opacity-100 transition-all duration-300">
                      <div className="bg-card text-card-foreground px-4 py-2 rounded-lg font-semibold text-center">
                        Learn More →
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-8 flex flex-col grow">
                    <h3 className=" text-2xl font-bold text-card-foreground mb-4 group-hover:text-muted-foreground transition-colors duration-300">
                      {service.title}
                    </h3>

                    <p className="text-muted-foreground mb-6 leading-relaxed grow">
                      {service.description}
                    </p>

                    {/* Features */}
                    <div className="space-y-2">
                      {service.features.map((feature, featureIndex) => (
                        <motion.div
                          key={feature}
                          initial={{ opacity: 0, x: -20 }}
                          animate={
                            isInView
                              ? { opacity: 1, x: 0 }
                              : { opacity: 0, x: -20 }
                          }
                          transition={{
                            duration: 0.4,
                            delay: index * 0.2 + featureIndex * 0.1 + 0.3,
                          }}
                          className="flex items-center space-x-3"
                        >
                          <div className="w-2 h-2 bg-secondary rounded-full shrink-0" />
                          <span className="text-sm font-medium text-muted-foreground">
                            {feature}
                          </span>
                        </motion.div>
                      ))}
                    </div>

                    {/* Bottom border animation */}
                    <DecorativeLine
                      animate={isInView ? { width: '100%' } : { width: 0 }}
                      transition={{ duration: 0.8, delay: index * 0.2 + 0.6 }}
                    />
                  </div>
                </motion.div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="text-center mt-16"
        >
          <p className="text-lg text-muted-foreground mb-6">
            Ready to start your dream project?
          </p>
          <motion.div
            whileHover={{ scale: 1.025 }}
            whileTap={{ scale: 0.975 }}
          >
            <Button
              className="h-16 px-8 text-lg"
              asChild
            >
              <Link
                href="/services"
                className="inline-flex items-center space-x-2 px-8 hover:shadow-lg transition-shadow duration-200"
              >
                <span>Explore All Services</span>
                <motion.span
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  →
                </motion.span>
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
