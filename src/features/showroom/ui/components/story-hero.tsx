'use client'

import type { Project } from '@/shared/db/schema'
import { motion } from 'motion/react'
import Image from 'next/image'
import { Badge } from '@/shared/components/ui/badge'

interface NamedItem {
  id: string
  name: string
}

interface Props {
  project: Project
  heroUrl: string | undefined
  trades: NamedItem[]
}

export function StoryHero({ project, heroUrl, trades }: Props) {
  const formattedDate = project.completedAt
    ? new Date(project.completedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  return (
    <section className="relative h-[70vh] min-h-125 overflow-hidden">
      {heroUrl
        ? (
            <motion.div
              className="absolute inset-0"
              initial={{ scale: 1.05 }}
              animate={{ scale: 1 }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            >
              <Image
                src={heroUrl}
                alt={project.title}
                fill
                className="object-cover"
                sizes="100vw"
                priority
              />
            </motion.div>
          )
        : (
            <div className="absolute inset-0 bg-linear-to-br from-muted to-muted-foreground/20" />
          )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-transparent" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10 lg:p-16">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {formattedDate && (
              <p className="mb-2 text-sm font-medium uppercase tracking-wider text-white/60">
                Completed
                {' '}
                {formattedDate}
              </p>
            )}
            <h1 className="mb-3 text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
              {project.title}
            </h1>
            <p className="mb-4 text-lg text-white/80">
              {project.city}
              {project.state ? `, ${project.state}` : ''}
            </p>
            {trades.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {trades.map(trade => (
                  <Badge key={trade.id} className="border-white/20 bg-white/15 text-white backdrop-blur-sm">
                    {trade.name}
                  </Badge>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
