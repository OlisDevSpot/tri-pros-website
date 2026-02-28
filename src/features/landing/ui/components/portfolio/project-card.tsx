'use client'

import type { PublicProject } from '@/shared/dal/server/landing/projects'
import { AnimatePresence, motion, useInView } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { Badge } from '@/shared/components/ui/badge'

export function ProjectCard({ row, index }: { row: PublicProject, index: number }) {
  const { project, heroImage } = row
  const [hovered, setHovered] = useState(false)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay: (index % 3) * 0.1 }}
    >
      <Link href={`/portfolio/${project.accessor}`}>
        <motion.div
          className="relative rounded-xl overflow-hidden bg-muted aspect-[4/3] cursor-pointer"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.25 }}
          onHoverStart={() => setHovered(true)}
          onHoverEnd={() => setHovered(false)}
        >
          {heroImage?.url
            ? (
                <Image
                  src={heroImage.url}
                  alt={project.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority={index < 2}
                />
              )
            : (
                <div className="h-full w-full bg-muted flex items-center justify-center">
                  <span className="text-muted-foreground text-sm">No image</span>
                </div>
              )}

          {/* Always-visible bottom gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

          {/* Bottom info */}
          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-1">
            <h3 className="text-white font-semibold text-lg leading-tight">{project.title}</h3>
            <p className="text-white/70 text-sm">
              {project.city}
              {project.state ? `, ${project.state}` : ''}
            </p>
          </div>

          {/* Hover overlay with description + tags */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                key="overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-black/60 flex flex-col justify-center items-start p-5 gap-3"
              >
                {project.description && (
                  <p className="text-white/90 text-sm leading-relaxed line-clamp-4">
                    {project.description}
                  </p>
                )}
                {project.hoRequirements && project.hoRequirements.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {project.hoRequirements.slice(0, 4).map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <span className="text-white text-sm font-medium underline underline-offset-2 mt-1">
                  View Project →
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </Link>
    </motion.div>
  )
}
