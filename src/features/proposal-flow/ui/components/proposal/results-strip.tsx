'use client'

import type { ProjectMediaFile } from '@/shared/db/schema'
import type { PortfolioMatch } from '@/shared/modules/projects/core/types'

import { useQueryClient } from '@tanstack/react-query'
import { ImagesIcon, LoaderIcon, RefreshCwIcon } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { OptimizedImage } from '@/shared/modules/media/core/components/display/optimized-image'
import { PhotoLightbox } from '@/shared/modules/media/core/components/display/photo-lightbox'
import { SHOWCASE_PROJECTS_STALE_MS } from '@/shared/modules/projects/core/constants/portfolio-match'
import { useTRPC } from '@/trpc/helpers'

interface Props {
  matches: PortfolioMatch[]
  heading: string
}

interface Gallery {
  title: string
  photos: ProjectMediaFile[]
  index: number
}

export function ResultsStrip({ matches, heading }: Props) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState<string | null>(null)
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set())
  const [gallery, setGallery] = useState<Gallery | null>(null)
  const openerRef = useRef<HTMLButtonElement | null>(null)

  const open = async (match: PortfolioMatch, opener: HTMLButtonElement) => {
    const { accessor, title } = match.row.project
    if (loading) {
      return
    }
    openerRef.current = opener
    setLoading(accessor)
    setFailed(prev => new Set([...prev].filter(a => a !== accessor)))
    try {
      // The featured project's detail hook fetched these ahead, so a tap usually resolves from cache.
      const detail = await queryClient.fetchQuery({
        ...trpc.projectsRouter.showroomDisplay.getDetail.queryOptions({ accessor }),
        staleTime: SHOWCASE_PROJECTS_STALE_MS,
      })
      const photos = detail?.media.all.filter(file => !file.mimeType.startsWith('video/')) ?? []
      if (photos.length === 0) {
        throw new Error('No photos')
      }
      setGallery({ title, photos, index: 0 })
    }
    catch {
      setFailed(prev => new Set(prev).add(accessor))
    }
    finally {
      setLoading(null)
    }
  }

  const close = useCallback(() => {
    setGallery(null)
    openerRef.current?.focus()
  }, [])
  const navigate = useCallback((index: number) => setGallery(prev => (prev ? { ...prev, index } : prev)), [])

  if (matches.length === 0) {
    return null
  }

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-sans text-xl leading-[1.2] font-medium">{heading}</h3>
        <p className="text-sm font-bold text-muted-foreground">Tap a project to see its photos</p>
      </div>
      <ul className="-mx-4.5 grid scroll-px-4.5 auto-cols-[78%] grid-flow-col snap-x snap-mandatory gap-3 overflow-x-auto px-4.5 pb-1 [scrollbar-width:none] @min-[700px]/proposal:mx-0 @min-[700px]/proposal:grid-flow-row @min-[700px]/proposal:grid-cols-2 @min-[700px]/proposal:overflow-visible @min-[700px]/proposal:px-0">
        {matches.map((match) => {
          const { project, heroImage, phaseCounts } = match.row
          const count = Object.values(phaseCounts).reduce((sum, n) => sum + n, 0)
          const meta = [project.city, project.projectDuration].filter(Boolean).join(' · ')
          const isLoading = loading === project.accessor
          const isFailed = failed.has(project.accessor)
          return (
            <li key={project.id} className="min-w-0 snap-start">
              <button
                type="button"
                aria-haspopup="dialog"
                aria-busy={isLoading}
                onClick={e => void open(match, e.currentTarget)}
                className="group/card grid w-full min-w-0 gap-2.5 rounded-xl text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="relative block aspect-16/10 overflow-hidden rounded-xl transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/card:-translate-y-0.5 motion-reduce:transition-none">
                  <OptimizedImage file={heroImage} alt={project.title} fill sizes="(max-width: 700px) 78vw, 40vw" />
                  <span className="absolute right-2.5 bottom-2.5 inline-flex items-center gap-1.5 rounded-full bg-scrim/70 px-2.25 py-1.5 text-xs leading-none font-bold text-on-media">
                    {isLoading
                      ? <LoaderIcon aria-hidden className="size-3.5 motion-safe:animate-spin" />
                      : isFailed
                        ? <RefreshCwIcon aria-hidden className="size-3.5" />
                        : <ImagesIcon aria-hidden className="size-3.5" />}
                    {isFailed && !isLoading ? 'Photos didn’t load' : `${count} ${count === 1 ? 'photo' : 'photos'}`}
                  </span>
                </span>
                <span className="grid gap-0.5">
                  <b className="font-sans text-base leading-tight font-semibold">{project.title}</b>
                  {meta && <small className="text-sm font-bold text-muted-foreground">{meta}</small>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {/* The page's container query makes its box the containing block for fixed children; the lightbox covers the viewport from body. */}
      {gallery && createPortal(
        <PhotoLightbox photos={gallery.photos} currentIndex={gallery.index} onClose={close} onNavigate={navigate} title={gallery.title} topInset="safe-area" />,
        document.body,
      )}
    </div>
  )
}
