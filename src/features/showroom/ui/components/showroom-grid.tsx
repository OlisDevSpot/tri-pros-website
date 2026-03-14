'use client'

import type { ShowroomProject } from '@/shared/entities/projects/types'
import { AnimatePresence, motion } from 'motion/react'
import { ShowroomProjectCard } from './showroom-project-card'

interface Props {
  projects: ShowroomProject[]
}

export function ShowroomGrid({ projects }: Props) {
  if (projects.length === 0) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <p className="text-lg">No projects match your filters.</p>
        <p className="mt-1 text-sm">Try adjusting your selection or clearing all filters.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence mode="popLayout">
        {projects.map((project, index) => (
          <motion.div
            key={project.project.id}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <ShowroomProjectCard project={project} index={index} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
