'use client'

import { animate, motion, useInView, useMotionValue } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import useMeasure from 'react-use-measure'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn } from '@/shared/lib/utils'
import { PhotoCard } from './photo-card'

const photos = [
  '/hero-photos/modern-house-1.png',
  '/portfolio-photos/modern-kitchen-1.jpeg',
  '/hero-photos/modern-house-2.png',
  '/portfolio-photos/modern-staircase-1.jpeg',
  '/hero-photos/modern-house-3.avif',
  '/portfolio-photos/modern-bathroom-1.jpeg',
  '/hero-photos/modern-house-4.webp',
]

const SLOW_DURATION = 25
const FAST_DURATION = 75

export default function PastProjects() {
  const containerRef = useRef(null)
  const isInView = useInView(containerRef, { once: true, margin: '-100px' })
  const isMobile = useIsMobile()

  const [ref, { width }] = useMeasure()
  const [duration, setDuration] = useState(SLOW_DURATION)

  const xTranslate = useMotionValue(0)
  const [mustFinish, setMustFinish] = useState(false)
  const [rerender, setRerender] = useState(false)

  useEffect(() => {
    let controls
    const finalPosition = -width / 2 - 4

    if (mustFinish) {
      controls = animate(xTranslate, [xTranslate.get(), finalPosition], {
        ease: 'linear',
        duration: duration * (1 - xTranslate.get() / finalPosition),
        repeat: 0,
        repeatType: 'loop',
        repeatDelay: 0,
        onComplete: () => {
          setMustFinish(false)
          setRerender(!rerender)
        },
      })
    }
    else {
      controls = animate(xTranslate, [0, finalPosition], {
        ease: 'linear',
        duration,
        repeat: Infinity,
        repeatType: 'loop',
        repeatDelay: 0,
      })
    }

    return () => controls.stop()
  }, [width, xTranslate, duration, mustFinish, rerender])

  return (
    <section
      className="py-20 lg:py-32 bg-background"
      ref={containerRef}
    >
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className=" text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Our Past
            {' '}
            <span className="text-primary">Projects</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Many thankful homeowners. Many satisfied clients.
          </p>
        </motion.div>
      </div>
      <div
        className={cn(
          'relative w-full overflow-x-hidden',
          !isMobile ? 'h-[400px]' : 'h-[250px]',
        )}
      >
        <div
          className="hidden lg:block absolute inset-0 bg-linear-to-r from-background from-5% via-transparent to-background to-95% z-10 pointer-events-none"
        />
        {/* MUST BE ABSOLUTE FOR WIDTH TO BE CALCULATED CORRECTLY */}
        <motion.div
          className="absolute left-0 flex gap-2 h-full"
          ref={ref}
          style={{ x: xTranslate }}
          onHoverStart={() => {
            setMustFinish(true)
            setDuration(FAST_DURATION)
          }}
          onHoverEnd={() => {
            setMustFinish(true)
            setDuration(SLOW_DURATION)
          }}
        >
          {[...photos, ...photos].map((photo, index) => (
            <PhotoCard
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              photo={photo}
            />
          ))}
        </motion.div>
      </div>
    </section>
  )
}
