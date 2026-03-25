'use client'

import type { MediaFile } from '@/shared/db/schema'
import type { BeforeAfterPairs } from '@/shared/entities/projects/schemas'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent } from '@/shared/components/ui/card'

interface PortfolioCardProject {
  id: string
  title: string
  city: string
  state: string | null
  projectDuration: string | null
  challengeDescription: string | null
  solutionDescription: string | null
  resultDescription: string | null
  homeownerQuote: string | null
  homeownerName: string | null
  beforeAfterPairsJSON: BeforeAfterPairs | null
  matchedScopeCount: number
  mediaFiles: MediaFile[]
}

interface PortfolioCardProps {
  project: PortfolioCardProject
}

function resolveHeroImage(mediaFiles: MediaFile[]): MediaFile | null {
  const hero = mediaFiles.find(f => f.isHeroImage)
  return hero ?? mediaFiles[0] ?? null
}

function resolveBeforeAfterImages(
  pairs: BeforeAfterPairs | null,
  mediaFiles: MediaFile[],
): { before: MediaFile | null, after: MediaFile | null } | null {
  if (!pairs || pairs.pairs.length === 0) {
    return null
  }
  const first = pairs.pairs[0]
  if (!first) {
    return null
  }

  const mediaById = new Map(mediaFiles.map(f => [Number(f.id), f]))
  const before = mediaById.get(first.beforeMediaId) ?? null
  const after = mediaById.get(first.afterMediaId) ?? null
  return { before, after }
}

export function PortfolioCard({ project }: PortfolioCardProps) {
  const heroImage = resolveHeroImage(project.mediaFiles)
  const beforeAfter = resolveBeforeAfterImages(project.beforeAfterPairsJSON, project.mediaFiles)

  return (
    <Card className="overflow-hidden">
      {/* Hero image */}
      {heroImage
        ? (
            <div className="relative h-64 w-full overflow-hidden bg-muted sm:h-80">
              <img
                alt={heroImage.name}
                className="h-full w-full object-cover"
                src={heroImage.url}
              />
              {project.matchedScopeCount > 0 && (
                <div className="absolute right-3 top-3">
                  <Badge className="bg-primary/90 text-primary-foreground shadow-sm">
                    {project.matchedScopeCount}
                    {' '}
                    matching
                    {project.matchedScopeCount === 1 ? ' scope' : ' scopes'}
                  </Badge>
                </div>
              )}
            </div>
          )
        : (
            <div className="relative flex h-48 w-full items-center justify-center bg-muted">
              <span className="text-sm text-muted-foreground">No photo available</span>
              {project.matchedScopeCount > 0 && (
                <div className="absolute right-3 top-3">
                  <Badge className="bg-primary/90 text-primary-foreground shadow-sm">
                    {project.matchedScopeCount}
                    {' '}
                    matching
                    {project.matchedScopeCount === 1 ? ' scope' : ' scopes'}
                  </Badge>
                </div>
              )}
            </div>
          )}

      <CardContent className="space-y-5 p-6">
        {/* Title + meta */}
        <div className="space-y-1">
          <h3 className="text-lg font-semibold leading-snug">{project.title}</h3>
          <p className="text-sm text-muted-foreground">
            {project.city}
            {project.state ? `, ${project.state}` : ''}
            {project.projectDuration ? ` · ${project.projectDuration}` : ''}
          </p>
        </div>

        {/* Before / After images */}
        {beforeAfter && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Before</p>
              {beforeAfter.before
                ? (
                    <div className="h-36 overflow-hidden rounded-md bg-muted">
                      <img
                        alt="Before"
                        className="h-full w-full object-cover"
                        src={beforeAfter.before.url}
                      />
                    </div>
                  )
                : (
                    <div className="flex h-36 items-center justify-center rounded-md bg-muted">
                      <span className="text-xs text-muted-foreground">No image</span>
                    </div>
                  )}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">After</p>
              {beforeAfter.after
                ? (
                    <div className="h-36 overflow-hidden rounded-md bg-muted">
                      <img
                        alt="After"
                        className="h-full w-full object-cover"
                        src={beforeAfter.after.url}
                      />
                    </div>
                  )
                : (
                    <div className="flex h-36 items-center justify-center rounded-md bg-muted">
                      <span className="text-xs text-muted-foreground">No image</span>
                    </div>
                  )}
            </div>
          </div>
        )}

        {/* Challenge → Solution → Result */}
        {(project.challengeDescription || project.solutionDescription || project.resultDescription) && (
          <div className="space-y-3">
            {project.challengeDescription && (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Challenge</p>
                <p className="text-sm leading-relaxed text-foreground/80">{project.challengeDescription}</p>
              </div>
            )}
            {project.solutionDescription && (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Solution</p>
                <p className="text-sm leading-relaxed text-foreground/80">{project.solutionDescription}</p>
              </div>
            )}
            {project.resultDescription && (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Result</p>
                <p className="text-sm leading-relaxed text-foreground/80">{project.resultDescription}</p>
              </div>
            )}
          </div>
        )}

        {/* Homeowner quote */}
        {project.homeownerQuote && (
          <blockquote className="rounded-lg border-l-4 border-primary/30 bg-muted/40 px-5 py-4">
            <p className="text-sm italic leading-relaxed text-foreground/80">
              &ldquo;
              {project.homeownerQuote}
              &rdquo;
            </p>
            {project.homeownerName && (
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                —
                {' '}
                {project.homeownerName}
              </p>
            )}
          </blockquote>
        )}
      </CardContent>
    </Card>
  )
}
