'use client'

import { motion, useInView } from 'motion/react'

import Image from 'next/image'
import Link from 'next/link'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { services } from '@/features/landing/data/company/services'
import { cn } from '@/lib/utils'

export default function ServicesList() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section
      ref={ref}
      className="py-20 lg:py-32"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-24"
        >
          <h2 className=" text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Our Construction
            {' '}
            <span className="text-secondary">Services</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Comprehensive construction solutions backed by 25+ years of
            experience and an unwavering commitment to quality craftsmanship.
          </p>
        </motion.div>

        {/* Services */}
        <div className="space-y-24">
          {services.map((service, index) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 50 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
              transition={{ duration: 0.8, delay: index * 0.2 }}
              className="group"
            >
              <div
                className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${
                  index % 2 === 1 ? 'lg:grid-flow-col-dense' : ''
                }`}
              >
                {/* Content */}
                <div
                  className={`space-y-6 ${
                    index % 2 === 1 ? 'lg:col-start-2' : ''
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center">
                      <span className="text-3xl">{service.icon}</span>
                    </div>
                    <div>
                      <h3 className=" text-2xl lg:text-3xl font-bold text-foreground">
                        {service.title}
                      </h3>
                      <p className="text-muted-foreground font-semibold">
                        {service.subtitle}
                      </p>
                    </div>
                  </div>

                  <p className="text-lg text-muted-foreground leading-relaxed">
                    {service.description}
                  </p>

                  {/* Key Features */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">
                      Key Features:
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                          className="flex items-start space-x-2"
                        >
                          <div className="w-2 h-2 bg-secondary rounded-full shrink-0 mt-2" />
                          <span className="text-sm text-muted-foreground">
                            {feature}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Project Details */}
                  <div className="grid grid-cols-2 gap-6 pt-4">
                    <div className="bg-linear-to-br from-primary/5 to-secondary/5 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-foreground mb-1">
                        {service.timeline}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Typical Timeline
                      </div>
                    </div>
                    <div className="bg-linear-to-br from-primary/5 to-secondary/5 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-foreground mb-1">
                        {service.priceRange}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Investment Range
                      </div>
                    </div>
                  </div>

                  {/* CTA */}
                  <div
                    className={cn(
                      'flex space-x-4 w-full',
                      index % 2 === 0 ? 'justify-start' : 'lg:justify-end',
                    )}
                  >
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        asChild
                        variant="outline"
                        size="lg"
                        className="text-lg h-16"
                      >
                        <Link
                          href={service.href}
                          className="bg-secondary text-secondary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-secondary/90 transition-colors duration-200"
                        >
                          Learn More
                        </Link>
                      </Button>
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        asChild
                        variant="default"
                        size="lg"
                        className="text-lg h-16"
                      >
                        <Link
                          href="/contact"
                          className="border-2 border-primary text-primary px-6 py-3 rounded-lg font-semibold hover:bg-primary hover:text-primary-foreground transition-colors duration-200"
                        >
                          Get Quote
                        </Link>
                      </Button>
                    </motion.div>
                  </div>
                </div>

                {/* Image */}
                <div
                  className={`${index % 2 === 1 ? 'lg:col-start-1' : ''} h-full`}
                >
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.3 }}
                    className="relative rounded-2xl aspect-video lg:aspect-auto overflow-hidden shadow-xl group-hover:shadow-2xl transition-shadow duration-300 h-full"
                  >
                    <Image
                      src={service.image}
                      alt={service.title}
                      width={600}
                      height={400}
                      className="h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    {/* Overlay CTA */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileHover={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="absolute bottom-6 left-6 right-6 opacity-0 group-hover:opacity-100"
                    >
                      <Link
                        href={service.href}
                        className="bg-secondary text-secondary-foreground px-6 py-3 rounded-lg font-semibold text-center block hover:bg-secondary/90 transition-colors duration-200"
                      >
                        Explore
                        {' '}
                        {service.title}
                        {' '}
                        →
                      </Link>
                    </motion.div>
                  </motion.div>
                </div>
              </div>

              {/* Divider */}
              {index < services.length - 1 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={isInView ? { width: '100%' } : { width: 0 }}
                  transition={{ duration: 1, delay: index * 0.2 + 0.8 }}
                  className="h-px bg-linear-to-r from-transparent via-border to-transparent mt-24"
                />
              )}
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="mt-32 bg-linear-to-br from-secondary/20 to-secondary/40 rounded-2xl p-8 lg:p-12 text-center text-primary-foreground"
        >
          <h3 className=" text-2xl lg:text-3xl font-bold mb-6">
            Not Sure Which Service You Need?
          </h3>
          <p className="text-lg mb-8 opacity-90 max-w-3xl mx-auto">
            Our expert team can help you determine the best approach for your
            project. Schedule a free consultation to discuss your vision and get
            personalized recommendations.
          </p>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              asChild
              variant="default"
              size="lg"
              className="text-lg h-16"
            >
              <Link
                href="/contact"
                className="inline-flex items-center space-x-2 px-8 py-4 rounded-lg font-semibold text-lg"
              >
                <span>Schedule Free Consultation</span>
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
