'use client'

import type { Project } from '@/shared/db/schema'
import { motion, useInView } from 'motion/react'
import { useRef } from 'react'
import { Card, CardContent } from '@/shared/components/ui/card'

interface Props {
  project: Project
  tradesCount: number
  scopesCount: number
}

export function StorySolution({ project, tradesCount, scopesCount }: Props) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  const hasContent = project.solutionDescription || project.resultDescription
  if (!hasContent) {
    return null
  }

  const stats = [
    project.projectDuration && { label: 'Duration', value: project.projectDuration },
    tradesCount > 0 && { label: 'Trades', value: String(tradesCount) },
    scopesCount > 0 && { label: 'Scopes', value: String(scopesCount) },
    project.completedAt && {
      label: 'Completed',
      value: new Date(project.completedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    },
  ].filter(Boolean) as Array<{ label: string, value: string }>

  return (
    <section ref={ref} className="bg-muted/20 py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">
            Our Approach
          </h2>
          <div className="h-1 w-12 rounded-full bg-primary" />
        </motion.div>

        <div className="grid gap-10 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {project.solutionDescription && (
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-lg leading-relaxed text-foreground/90"
              >
                {project.solutionDescription}
              </motion.p>
            )}
            {project.resultDescription && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="rounded-lg border-l-4 border-green-500/30 bg-green-50/50 p-5 dark:bg-green-950/20"
              >
                <p className="mb-1 text-sm font-medium text-green-700 dark:text-green-400">The Result</p>
                <p className="leading-relaxed text-foreground/80">
                  {project.resultDescription}
                </p>
              </motion.div>
            )}
          </div>

          {/* Stats */}
          {stats.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="grid grid-cols-2 gap-3"
            >
              {stats.map(stat => (
                <Card key={stat.label} className="bg-background/60">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </section>
  )
}
