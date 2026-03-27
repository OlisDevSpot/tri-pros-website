'use client'

import type { MediaFile, Project } from '@/shared/db/schema'
import type { BeforeAfterPairs } from '@/shared/entities/projects/schemas'
import type { ProjectMediaGroups } from '@/shared/entities/projects/types'
import { AnimatePresence, motion, useInView } from 'motion/react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Badge } from '@/shared/components/ui/badge'
import { cn } from '@/shared/lib/utils'

const ReactCompareSlider = dynamic(
  () => import('react-compare-slider').then(mod => mod.ReactCompareSlider),
  {
    ssr: false,
    loading: () => <div className="h-full w-full bg-muted/30" />,
  },
)

interface ResolvedPair {
  before: MediaFile
  after: MediaFile
  label: string
  confidence: number
}

interface Props {
  project: Project
  media: ProjectMediaGroups
}

export function StoryBeforeAfter({ project, media }: Props) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  const [activePairIndex, setActivePairIndex] = useState(0)

  const pairs = useMemo<ResolvedPair[]>(() => {
    const pairsData = project.beforeAfterPairsJSON as BeforeAfterPairs | null
    if (!pairsData?.pairs?.length) {
      return []
    }

    const allMedia = [...media.before, ...media.during, ...media.after, ...media.uncategorized, ...media.hero]
    const mediaById = new Map(allMedia.map(m => [m.id, m]))

    return pairsData.pairs
      .map((p) => {
        const before = mediaById.get(p.beforeMediaId)
        const after = mediaById.get(p.afterMediaId)
        if (!before || !after) {
          return null
        }
        return { before, after, label: p.label, confidence: p.confidence }
      })
      .filter((p): p is ResolvedPair => p !== null)
      .sort((a, b) => b.confidence - a.confidence)
  }, [project.beforeAfterPairsJSON, media])

  const handlePairSelect = useCallback((index: number) => {
    setActivePairIndex(index)
  }, [])

  if (pairs.length === 0) {
    return null
  }

  const activePair = pairs[activePairIndex]

  return (
    <section ref={ref} className="bg-background py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="mb-10 text-center"
        >
          <h2 className="mb-2 text-2xl font-bold text-foreground lg:text-3xl">
            Before & After
          </h2>
          <p className="text-muted-foreground">
            Drag the slider to see the transformation
          </p>
        </motion.div>

        {/* Pair selector pills */}
        {pairs.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mb-8 flex flex-wrap justify-center gap-2"
          >
            {pairs.map((pair, i) => (
              <Badge
                key={`${pair.before.id}-${pair.after.id}`}
                variant={i === activePairIndex ? 'default' : 'outline'}
                className="cursor-pointer px-4 py-1.5 text-sm transition-colors"
                onClick={() => handlePairSelect(i)}
              >
                {pair.label}
              </Badge>
            ))}
          </motion.div>
        )}

        {/* Compare slider — stays mounted, images crossfade inside */}
        <div
          className="overflow-hidden rounded-2xl shadow-2xl"
          style={{ height: 'clamp(300px, 55vh, 650px)' }}
        >
          <ReactCompareSlider
            itemOne={(
              <div className="relative h-full w-full">
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={activePair.before.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0"
                  >
                    <Image
                      src={activePair.before.url}
                      alt={`${activePair.label} — Before`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 80vw, 1200px"
                      priority={activePairIndex === 0}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
            itemTwo={(
              <div className="relative h-full w-full">
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={activePair.after.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0"
                  >
                    <Image
                      src={activePair.after.url}
                      alt={`${activePair.label} — After`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 80vw, 1200px"
                      priority={activePairIndex === 0}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
            className="h-full"
          />
        </div>

        {/* Before / After labels below slider */}
        <div className="mt-3 flex justify-between px-2">
          <span className="text-sm font-medium text-muted-foreground">Before</span>
          <span className="text-sm font-medium text-muted-foreground">After</span>
        </div>

        {/* Thumbnail strip for quick pair browsing */}
        {pairs.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
          >
            {pairs.map((pair, i) => (
              <button
                key={`${pair.before.id}-${pair.after.id}`}
                type="button"
                onClick={() => handlePairSelect(i)}
                className={cn(
                  'group relative overflow-hidden rounded-xl transition-all',
                  i === activePairIndex
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                    : 'opacity-70 hover:opacity-100',
                )}
              >
                {/* Side-by-side thumbnail preview */}
                <div className="flex aspect-2/1">
                  <div className="relative w-1/2">
                    <Image
                      src={pair.before.url}
                      alt={`${pair.label} before`}
                      fill
                      className="object-cover"
                      sizes="120px"
                    />
                  </div>
                  <div className="relative w-1/2">
                    <Image
                      src={pair.after.url}
                      alt={`${pair.label} after`}
                      fill
                      className="object-cover"
                      sizes="120px"
                    />
                  </div>
                  {/* Divider line */}
                  <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/60" />
                </div>
                {/* Label */}
                <div className="bg-muted/80 px-2 py-1.5">
                  <p className="truncate text-xs font-medium text-foreground">{pair.label}</p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  )
}
