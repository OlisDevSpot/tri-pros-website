'use client'

import { Compass, Gem, Target } from 'lucide-react'
import { motion, useInView } from 'motion/react'
import { useRef } from 'react'
import { FounderStory } from './founder-story'

const FADE_UP_VISIBLE = { opacity: 1, y: 0 }
const FADE_UP_HIDDEN = { opacity: 0, y: 30 }
const REVEAL_EASE = [0.22, 1, 0.36, 1] as const

const pillars = [
  {
    icon: Target,
    title: 'Vision',
    description:
      'To be the premier luxury construction company, setting the standard for quality and innovation in Southern California.',
  },
  {
    icon: Gem,
    title: 'Values',
    description:
      'Integrity, excellence, innovation, and an unwavering commitment to client satisfaction at every step.',
  },
  {
    icon: Compass,
    title: 'Purpose',
    description:
      'Creating lasting legacies through exceptional craftsmanship and deeply personalized service.',
  },
]

export function CompanyStory() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section ref={ref} className="py-20 lg:py-32">
      <div className="container space-y-24 lg:space-y-32">
        {/* Section Header */}
        <motion.div
          initial={FADE_UP_HIDDEN}
          animate={isInView ? FADE_UP_VISIBLE : FADE_UP_HIDDEN}
          transition={{ duration: 0.7, ease: REVEAL_EASE }}
          className="text-center max-w-4xl mx-auto"
        >
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-secondary font-semibold mb-5">
            <span className="h-px w-8 bg-secondary/70" aria-hidden />
            The Journey
            <span className="h-px w-8 bg-secondary/70" aria-hidden />
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
            How Tri Pros Remodeling Came to Be — A Story of
            {' '}
            <span className="text-secondary">Drive & Dedication</span>
          </h2>
        </motion.div>

        <FounderStory
          founderName="Sean Phil"
          founderImgSrc="/company/employees/sean-headshot.jpeg"
          isInView={isInView}
          Quote={() => (
            <figure className="relative pl-6 border-l-2 border-secondary/60">
              <blockquote className="font-script text-xl sm:text-2xl text-foreground italic leading-snug">
                &ldquo;We don&apos;t just build structures; we craft legacies
                that families will cherish for generations.&rdquo;
              </blockquote>
              <figcaption className="text-sm text-muted-foreground mt-3">
                — Sean Phil, Founder
              </figcaption>
            </figure>
          )}
        >
          <p className="text-primary">
            My name is Sean, and I learned responsibility long before construction entered my life. My time in the Israeli Special Forces taught me what it means to stay calm under pressure and to rely on the people beside you. Later, working with U.S. Marines and American veterans showed me a different kind of strength — the quiet kind that comes from honesty, grit, and following through.
          </p>
          <p>
            When my military career ended, I focused on building a stable life for my family. There&apos;s nothing glamorous about raising kids and keeping a home running, but it teaches you a lot about patience, integrity, and doing what needs to be done. That&apos;s what pushed me toward construction. It felt grounded, real, and aligned with the values I wanted to live by.
          </p>
          <p>
            As I learned the trade, I saw how often families were let down by unfinished work, broken promises, and unnecessary stress. After helping my own relatives fix a nightmare remodel, it became clear to me that people deserved better. If they trusted me with their home, I owed them clear communication, dependable work, and the kind of follow-through I was raised on.
          </p>
          <p>
            That&apos;s the foundation behind Tri Pros Remodeling. Different uniform, different mission — but the same commitment to showing up, doing the job right, and taking care of people every step of the way.
          </p>
        </FounderStory>

        {/* Mission Statement — architectural strip, no nested cards or emoji */}
        <motion.div
          initial={FADE_UP_HIDDEN}
          animate={isInView ? FADE_UP_VISIBLE : FADE_UP_HIDDEN}
          transition={{ duration: 0.8, delay: 0.2, ease: REVEAL_EASE }}
          className="relative isolate overflow-hidden rounded-2xl border border-border/60 bg-linear-to-br from-primary/5 via-background to-secondary/5 px-6 py-12 sm:px-10 sm:py-16 lg:px-16 lg:py-20"
        >
          {/* Decorative ambient glow */}
          <div
            className="absolute -top-32 -right-32 size-80 rounded-full bg-secondary/15 blur-3xl pointer-events-none -z-10"
            aria-hidden
          />
          <div
            className="absolute -bottom-32 -left-32 size-80 rounded-full bg-primary/15 blur-3xl pointer-events-none -z-10"
            aria-hidden
          />

          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="inline-block text-xs uppercase tracking-[0.22em] text-secondary font-semibold mb-4">
              Our Mission
            </span>
            <p className="text-xl sm:text-2xl text-foreground leading-relaxed font-medium">
              We transform architectural visions into extraordinary realities —
              creating spaces where life&apos;s most precious moments unfold,
              where businesses thrive, and where communities flourish.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border/60 rounded-xl overflow-hidden border border-border/60">
            {pillars.map((pillar, i) => (
              <motion.div
                key={pillar.title}
                initial={FADE_UP_HIDDEN}
                animate={isInView ? FADE_UP_VISIBLE : FADE_UP_HIDDEN}
                transition={{ duration: 0.6, delay: 0.3 + i * 0.1, ease: REVEAL_EASE }}
                className="bg-background/80 backdrop-blur-sm px-6 py-8 flex flex-col items-start gap-4"
              >
                <span className="inline-flex items-center justify-center size-11 rounded-lg bg-secondary/15 text-secondary">
                  <pillar.icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-2">
                    {pillar.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
