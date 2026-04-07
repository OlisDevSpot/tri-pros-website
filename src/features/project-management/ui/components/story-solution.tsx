'use client'

import type { Project } from '@/shared/db/schema'
import { ArrowRight } from 'lucide-react'
import { motion, useInView } from 'motion/react'
import Link from 'next/link'
import { useRef } from 'react'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent } from '@/shared/components/ui/card'

interface NamedItem {
  id: string
  name: string
}

interface TradeWithScopes {
  trade: NamedItem
  scopes: NamedItem[]
}

interface Props {
  project: Project
  tradesWithScopes: TradeWithScopes[]
}

export function StorySolution({ project, tradesWithScopes }: Props) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  const hasContent = project.solutionDescription || project.resultDescription || tradesWithScopes.length > 0
  if (!hasContent) {
    return null
  }

  const stats = [
    project.projectDuration && { label: 'Duration', value: project.projectDuration },
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
          {/* Left column — text content */}
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

            {/* Stats row */}
            {stats.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ duration: 0.6, delay: 0.25 }}
                className="flex gap-3"
              >
                {stats.map(stat => (
                  <Card key={stat.label} className="bg-background/60">
                    <CardContent className="px-5 py-3">
                      <p className="text-xl font-bold text-foreground">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </motion.div>
            )}
          </div>

          {/* Right column — trades & scopes breakdown */}
          {tradesWithScopes.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="space-y-4"
            >
              <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Trades & Scopes
              </p>
              {tradesWithScopes.map(({ trade, scopes }) => (
                <Card key={trade.id} className="bg-background/60">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-primary text-primary-foreground">{trade.name}</Badge>
                      <Link
                        href={`/portfolio/projects?trades=${trade.id}`}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        View similar
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                    {scopes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {scopes.map(scope => (
                          <Link
                            key={scope.id}
                            href={`/portfolio/projects?scopes=${scope.id}`}
                          >
                            <Badge
                              variant="outline"
                              className="cursor-pointer transition-colors hover:bg-primary/10 hover:border-primary/30"
                            >
                              {scope.name}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    )}
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
