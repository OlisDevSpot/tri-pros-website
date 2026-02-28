'use client'

import type { ProjectDetail } from '@/shared/dal/server/landing/projects'
import { motion, useInView } from 'motion/react'
import Image from 'next/image'
import { useRef } from 'react'
import { ReactCompareSlider } from 'react-compare-slider'

interface Props {
  media: NonNullable<ProjectDetail>['media']
}

export function BeforeAfterGallery({ media }: Props) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  const beforeImage = media.before[0]
  const afterImage = media.after[0]

  if (!beforeImage || !afterImage) {
    return null
  }

  return (
    <section ref={ref} className="py-16 lg:py-24 bg-muted/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
            Before &amp; After
          </h2>
          <p className="text-muted-foreground">Drag the slider to compare</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="rounded-2xl overflow-hidden shadow-2xl max-h-[70vh]"
        >
          <ReactCompareSlider
            itemOne={(
              <div className="relative w-full h-full">
                <Image src={beforeImage.url} alt="Before" fill className="object-cover" />
              </div>
            )}
            itemTwo={(
              <div className="relative w-full h-full">
                <Image src={afterImage.url} alt="After" fill className="object-cover" />
              </div>
            )}
            style={{ height: '60vh' }}
          />
        </motion.div>

        <div className="flex justify-between mt-3 px-2">
          <span className="text-sm text-muted-foreground font-medium">Before</span>
          <span className="text-sm text-muted-foreground font-medium">After</span>
        </div>
      </div>
    </section>
  )
}
