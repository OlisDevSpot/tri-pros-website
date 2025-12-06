'use client'

import { motion, useInView } from 'motion/react'

import { useRef } from 'react'
import { TextWithLine } from '@/components/text-with-line'
import { FounderStory } from './founder-story'

export default function CompanyStory() {
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
          className="text-center mb-16"
        >
          <h2 className=" text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            The Journey Behind Becoming Tri Pros Remodeling - A Story of
            {' '}
            <span className="text-secondary">Drive & Dedication</span>
          </h2>
        </motion.div>

        {/* The Journey */}
        <div className="flex flex-col gap-12">
          <FounderStory />
          <div
            className="relative grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center mb-20 w-full rounded-lg overflow-hidden"
          >
            <img
              src="/company/oliver-headshot.jpg"
              className="absolute inset-0 grayscale-50 w-[50%] h-full object-cover z-[-1]"
            />
            <div className="w-full h-full flex items-end justify-center">
              <h3 className="text-2xl lg:text-3xl font-bold text-foreground whitespace-pre-line text-center">
                Ophir "Oliver" Porat
              </h3>
            </div>
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
              transition={{ duration: 0.8 }}
              className="space-y-6"
            >
              <div className="space-y-4 text-foreground/80 leading-relaxed font-semibold">
                <TextWithLine text="The Founder&apos;s Vision" />
                <p>
                  Oliver Porat began his journey in construction at the age of 16,
                  working alongside his grandfather, a master carpenter who
                  immigrated from Italy with nothing but his tools and an
                  uncompromising dedication to craftsmanship.
                </p>
                <p>
                  After decades of honing his skills and learning from the
                  industry&apos;s finest artisans, Robert founded Elite
                  Construction in 1998 with a simple yet powerful vision: to
                  create architectural masterpieces that would stand as testaments
                  to quality for generations to come.
                </p>
                <p>
                  Today, his son Michael and daughter Sarah continue this legacy,
                  bringing modern innovation to time-honored traditions, ensuring
                  that every Tri Pros Remodeling project exceeds the highest
                  standards of excellence.
                </p>
              </div>

              <div className="bg-card rounded-lg p-6 border-l-4 border-secondary">
                <blockquote className="font-script text-xl text-foreground italic">
                  &ldquo;We don&apos;t just build structures; we craft legacies
                  that families will cherish for generations.&rdquo;
                </blockquote>
                <cite className="text-sm text-foreground/80 mt-2 block">
                  — Oliver Porat, Founder
                </cite>
              </div>
            </motion.div>

            {/* <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="rounded-2xl overflow-hidden shadow-xl">
                <Image
                  src="/oliver-headshot.jpg"
                  alt="Oliver Porat, Founder"
                  width={500}
                  height={600}
                  className="object-cover"
                />
              </div>
              <div className="absolute -bottom-4 -right-4 bg-white rounded-xl p-4 shadow-lg border border-border/20">
                <div className="text-center">
                  <div className="text-lg font-bold text-secondary">
                    Oliver Porat
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Founder & Master Craftsman
                  </div>
                </div>
              </div>
            </motion.div> */}
          </div>
        </div>

        {/* Mission Statement */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="bg-linear-to-br from-primary/5 to-secondary/5 rounded-2xl p-8 lg:p-12 text-center"
        >
          <h3 className=" text-2xl lg:text-3xl font-bold text-foreground mb-6">
            Our Mission
          </h3>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-4xl mx-auto mb-8">
            At Tri Pros Remodeling, we are committed to transforming
            architectural visions into extraordinary realities. We believe that
            exceptional construction goes beyond building; it&apos;s about
            creating spaces where life&apos;s most precious moments unfold,
            where businesses thrive, and where communities flourish.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="text-center"
            >
              <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎯</span>
              </div>
              <h4 className="font-semibold text-foreground mb-2">Vision</h4>
              <p className="text-sm text-muted-foreground">
                To be the premier luxury construction company, setting the
                standard for quality and innovation.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="text-center"
            >
              <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💎</span>
              </div>
              <h4 className="font-semibold text-foreground mb-2">Values</h4>
              <p className="text-sm text-muted-foreground">
                Integrity, excellence, innovation, and unwavering commitment to
                client satisfaction.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.6, delay: 1 }}
              className="text-center"
            >
              <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🚀</span>
              </div>
              <h4 className="font-semibold text-foreground mb-2">Purpose</h4>
              <p className="text-sm text-muted-foreground">
                Creating lasting legacies through exceptional craftsmanship and
                personalized service.
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
