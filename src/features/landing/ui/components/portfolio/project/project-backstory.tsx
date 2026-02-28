'use client'

import type { ProjectDetail } from '@/shared/dal/server/landing/projects'
import { motion, useInView } from 'motion/react'
import { useRef } from 'react'

interface Props {
  project: NonNullable<ProjectDetail>['project']
}

export function ProjectBackstory({ project }: Props) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  const hasContent = project.backstory || project.description

  if (!hasContent) {
    return null
  }

  return (
    <section ref={ref} className="py-16 lg:py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Backstory text */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
            transition={{ duration: 0.6 }}
            className="space-y-4"
          >
            <h2 className="text-2xl lg:text-3xl font-bold text-foreground">
              About This Project
            </h2>
            <p className="text-muted-foreground leading-relaxed text-lg">
              {project.backstory ?? project.description}
            </p>
          </motion.div>

          {/* Key stats */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <Stat label="Location" value={`${project.city}${project.state ? `, ${project.state}` : ''}`} />
            {project.zip && <Stat label="Zip Code" value={project.zip} />}
            {project.createdAt && (
              <Stat
                label="Completed"
                value={new Date(project.createdAt).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              />
            )}
            {project.hoRequirements && project.hoRequirements.length > 0 && (
              <Stat label="Project Type" value={project.hoRequirements[0] ?? ''} />
            )}
          </motion.div>
        </div>
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string, value: string }) {
  return (
    <div className="bg-muted/40 rounded-xl p-5 space-y-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
      <p className="text-foreground font-semibold text-lg">{value}</p>
    </div>
  )
}
