'use client'

import { motion, useInView } from 'motion/react'

import { useRef } from 'react'
import { FounderStory } from './founder-story'

export default function CompanyStory() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section
      ref={ref}
      className="py-20 lg:py-32"
    >
      <div className="container space-y-24">
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

        <FounderStory
          founderName="Sean Phil"
          founderImgSrc="/company/employees/sean-headshot.jpeg"
          isInView={isInView}
        >
          <div className="space-y-4">
            <p className="text-primary">
              My name is Sean, and I learned responsibility long before construction entered my life. My time in the Israeli Special Forces taught me what it means to stay calm under pressure and to rely on the people beside you. Later, working with U.S. Marines and American veterans showed me a different kind of strength — the quiet kind that comes from honesty, grit, and following through.
            </p>
          </div>
          <div className="space-y-4">
            <p>
              When my military career ended, I focused on building a stable life for my family. There’s nothing glamorous about raising kids and keeping a home running, but it teaches you a lot about patience, integrity, and doing what needs to be done. That’s what pushed me toward construction. It felt grounded, real, and aligned with the values I wanted to live by.
            </p>
            <p>
              As I learned the trade, I saw how often families were let down by unfinished work, broken promises, and unnecessary stress. After helping my own relatives fix a nightmare remodel, it became clear to me that people deserved better. If they trusted me with their home, I owed them clear communication, dependable work, and the kind of follow-through I was raised on.
            </p>
            <p>
              That’s the foundation behind Tri Pros Remodeling. Different uniform, different mission — but the same commitment to showing up, doing the job right, and taking care of people every step of the way.
            </p>
          </div>
        </FounderStory>
        <FounderStory
          founderName='Ophir "Oliver" Porat'
          flipOrder
          founderImgSrc="/company/employees/ophir-full-body.jpg"
          isInView={isInView}
          Quote={() => (
            <div className="bg-card rounded-lg p-6 border border-border/40 border-l-4 border-l-secondary shadow-md">
              <blockquote className="font-script text-xl text-foreground italic">
                &ldquo;We don&apos;t just build structures; we craft legacies
                that families will cherish for generations.&rdquo;
              </blockquote>
              <cite className="text-sm text-foreground/80 mt-2 block">
                — Oliver Porat, Founder
              </cite>
            </div>
          )}
        >
          <p>
            My name is Ophir, but most people know me as Oliver. From an early age I grew up with construction all around me. My dad was a contractor and a fearless home-DIYer, the kind of person who couldn’t walk past a wall without wondering how to improve it. I spent my childhood watching him turn sketches into structures, problems into plans, and raw materials into something that felt solid and meaningful.
          </p>
          <p>
            Once I was old enough to pick up real tools, I was hooked. Seeing what could be created with today’s materials and technology pulled me in completely. I realized this wasn’t just a hobby or a family habit—it was a craft worth dedicating myself to.
          </p>
          <p>
            Those early lessons shaped everything I do now. At Tri Pros Remodeling, I carry that same respect for the work forward, aiming for results that are honest, durable, and thoughtfully built. I’m not here to impress with flash—I’m here to deliver work you can rely on for years to come.
          </p>
        </FounderStory>

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
