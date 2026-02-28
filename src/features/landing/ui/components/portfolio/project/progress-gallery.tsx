'use client'

import type { ProjectDetail } from '@/shared/dal/server/landing/projects'
import { X } from 'lucide-react'
import { motion, useInView } from 'motion/react'
import Image from 'next/image'
import { useRef, useState } from 'react'
import { Dialog, DialogContent } from '@/shared/components/ui/dialog'

interface Props {
  media: NonNullable<ProjectDetail>['media']
}

export function ProgressGallery({ media }: Props) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const duringPhotos = media.during

  if (duringPhotos.length === 0) {
    return null
  }

  return (
    <section ref={ref} className="py-16 lg:py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
            Progress Photos
          </h2>
          <p className="text-muted-foreground">Behind the scenes of the build</p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {duringPhotos.map((file, index) => (
            <motion.button
              key={file.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="relative aspect-square rounded-lg overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
              onClick={() => setLightboxSrc(file.url)}
              whileHover={{ scale: 1.03 }}
            >
              <Image
                src={file.url}
                alt={file.name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            </motion.button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      <Dialog open={lightboxSrc !== null} onOpenChange={() => setLightboxSrc(null)}>
        <DialogContent className="max-w-4xl p-2 bg-black/90 border-0">
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute top-3 right-3 z-10 text-white/80 hover:text-white"
          >
            <X size={24} />
          </button>
          {lightboxSrc && (
            <div className="relative w-full" style={{ minHeight: '50vh' }}>
              <Image
                src={lightboxSrc}
                alt="Progress photo"
                fill
                className="object-contain rounded"
                sizes="100vw"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
