'use client'

import type { ProjectDetail } from '@/shared/dal/server/landing/projects'
import { motion, useInView } from 'motion/react'
import { useRef } from 'react'

interface Props {
  media: NonNullable<ProjectDetail>['media']
}

export function ProjectVideosGallery({ media }: Props) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  if (media.videos.length === 0) {
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
            Project Videos
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {media.videos.map((file, index) => (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="rounded-xl overflow-hidden bg-black aspect-video"
            >
              <video
                src={file.url}
                poster={file.thumbnailUrl ?? undefined}
                controls
                preload="none"
                className="w-full h-full object-cover"
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
