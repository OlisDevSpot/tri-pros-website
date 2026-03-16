'use client'

import type { ProjectMediaGroups } from '@/shared/entities/projects/types'
import { motion, useInView } from 'motion/react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useRef } from 'react'

const ReactCompareSlider = dynamic(
  () => import('react-compare-slider').then(mod => mod.ReactCompareSlider),
  { ssr: false },
)

interface Props {
  media: ProjectMediaGroups
}

export function StoryTransformation({ media }: Props) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  const beforeImage = media.before[0]
  const afterImage = media.after[0]

  if (!beforeImage || !afterImage) {
    return null
  }

  const additionalAfter = media.after.slice(1)

  return (
    <section ref={ref} className="bg-muted/20 py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="mb-10 text-center"
        >
          <h2 className="mb-2 text-2xl font-bold text-foreground lg:text-3xl">
            The Transformation
          </h2>
          <p className="text-muted-foreground">Drag the slider to compare before and after</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="overflow-hidden rounded-2xl shadow-2xl"
        >
          <ReactCompareSlider
            itemOne={(
              <div className="relative h-full w-full">
                <Image src={beforeImage.url} alt="Before" fill className="object-cover" />
              </div>
            )}
            itemTwo={(
              <div className="relative h-full w-full">
                <Image src={afterImage.url} alt="After" fill className="object-cover" />
              </div>
            )}
            style={{ height: '60vh', maxHeight: '70vh' }}
          />
        </motion.div>

        <div className="mt-3 flex justify-between px-2">
          <span className="text-sm font-medium text-muted-foreground">Before</span>
          <span className="text-sm font-medium text-muted-foreground">After</span>
        </div>

        {/* Additional after photos */}
        {additionalAfter.length > 0 && (
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3">
            {additionalAfter.map((file, i) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                className="relative aspect-4/3 overflow-hidden rounded-xl"
              >
                <Image
                  src={file.url}
                  alt={file.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 33vw"
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
