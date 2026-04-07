'use client'

import type { MediaFile, Project } from '@/shared/db/schema'

import { PencilIcon } from 'lucide-react'
import { motion } from 'motion/react'
import Link from 'next/link'

import { OptimizedImage } from '@/shared/components/optimized-image'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'
import { useAbility } from '@/shared/permissions/hooks'

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
  heroImage: MediaFile | undefined
  tradesWithScopes: TradeWithScopes[]
}

export function StoryHero({ project, heroImage, tradesWithScopes }: Props) {
  const ability = useAbility()
  const canEdit = ability.can('update', 'Project')

  const formattedDate = project.completedAt
    ? new Date(project.completedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  return (
    <section className="relative h-[70vh] min-h-125 overflow-hidden">
      {heroImage
        ? (
            <motion.div
              className="absolute inset-0"
              initial={{ scale: 1.05 }}
              animate={{ scale: 1 }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            >
              <OptimizedImage
                file={heroImage}
                alt={project.title}
                fill
                sizes="100vw"
                priority
              />
            </motion.div>
          )
        : (
            <div className="absolute inset-0 bg-linear-to-br from-muted to-muted-foreground/20" />
          )}

      {/* Gradient overlays — top for navbar visibility, bottom for content */}
      <div className="absolute inset-0 bg-linear-to-b from-background/70 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-linear-to-t from-background/80 via-background/30 to-transparent" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10 lg:p-16">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {formattedDate && (
              <p className="mb-2 text-sm font-medium uppercase tracking-wider text-foreground/60">
                Completed
                {' '}
                {formattedDate}
              </p>
            )}
            <div className="mb-3 flex items-center gap-3">
              <h1 className="text-4xl font-bold text-foreground sm:text-5xl lg:text-6xl">
                {project.title}
              </h1>
              {canEdit && (
                <Button
                  asChild
                  size="icon"
                  variant="ghost"
                  className="size-9 shrink-0 rounded-full text-foreground/60 backdrop-blur-sm hover:bg-foreground/10 hover:text-foreground"
                >
                  <Link href={ROOTS.dashboard.projects.byId(project.id)}>
                    <PencilIcon className="size-4" />
                  </Link>
                </Button>
              )}
            </div>
            <p className="mb-5 text-lg text-foreground/80">
              {project.city}
              {project.state ? `, ${project.state}` : ''}
            </p>

            {/* Trades → Scopes grouped layout */}
            {tradesWithScopes.length > 0 && (
              <div className="flex flex-wrap gap-4">
                {tradesWithScopes.map(({ trade, scopes }) => (
                  <div key={trade.id} className="flex flex-col gap-1.5">
                    <Badge className="w-fit bg-primary text-primary-foreground">
                      {trade.name}
                    </Badge>
                    {scopes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pl-1">
                        {scopes.map(scope => (
                          <Badge
                            key={scope.id}
                            variant="outline"
                            className="border-foreground/20 bg-foreground/10 text-foreground/90 backdrop-blur-sm"
                          >
                            {scope.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
