'use client'

import type { ProjectDetail } from '@/shared/dal/server/landing/projects'
import { motion } from 'motion/react'
import Image from 'next/image'
import { Badge } from '@/shared/components/ui/badge'

interface Props {
  project: NonNullable<ProjectDetail>['project']
  heroUrl?: string
}

export function ProjectHero({ project, heroUrl }: Props) {
  return (
    <div className="relative h-[70vh] w-full overflow-hidden">
      {heroUrl
        ? (
            <motion.div
              className="absolute inset-0"
              initial={{ scale: 1.08 }}
              animate={{ scale: 1 }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            >
              <Image
                src={heroUrl}
                alt={project.title}
                fill
                className="object-cover"
                priority
              />
            </motion.div>
          )
        : (
            <div className="h-full w-full bg-muted" />
          )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* Content */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 p-8 lg:p-16 space-y-3"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3 }}
      >
        <h1 className="text-4xl lg:text-6xl font-bold text-white">{project.title}</h1>
        <p className="text-white/70 text-lg">
          {project.city}
          {project.state ? `, ${project.state}` : ''}
        </p>
        {project.hoRequirements && project.hoRequirements.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {project.hoRequirements.map(tag => (
              <Badge key={tag} variant="secondary" className="text-sm">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
