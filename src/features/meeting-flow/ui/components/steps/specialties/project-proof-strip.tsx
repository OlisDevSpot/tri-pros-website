'use client'

import type { ShowcaseProject } from '@/features/meeting-flow/types'
import { SHOWCASE_PROOF_LIMIT } from '@/features/meeting-flow/constants/showcase'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeStage } from '@/features/meeting-flow/contexts/trade-stage-context'
import { projectMedia } from '@/features/meeting-flow/lib/to-showcase-media'
import { OptimizedImage } from '@/shared/components/optimized-image'
import { Toggle } from '@/shared/components/ui/toggle'

interface ProjectProofStripProps {
  projects: ShowcaseProject[]
  currentKey: string | null
}

/** "Our projects · N" and up to four thumbnails that put that project on stage. Hidden below two projects. */
export function ProjectProofStrip({ projects, currentKey }: ProjectProofStripProps) {
  const { showMedia } = useTradeStage()

  if (projects.length < 2) {
    return null
  }

  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-1.5 @4xl/specialties:top-auto @4xl/specialties:right-5 @4xl/specialties:bottom-4">
      <p className="text-xs font-semibold text-white [text-shadow:0_1px_6px_rgb(0_0_0/0.7)]">
        {`${SPECIALTIES_COPY.showcase.ourProjects} · ${projects.length}`}
      </p>
      <div className="flex gap-2">
        {projects.slice(0, SHOWCASE_PROOF_LIMIT).map((project) => {
          const media = projectMedia(project)
          return (
            <Toggle
              key={project.id}
              aria-label={media.caption}
              className="relative h-13 w-18 overflow-hidden rounded-[3px] border-2 border-white/50 p-0 hover:bg-transparent data-[state=on]:border-white data-[state=on]:bg-transparent"
              pressed={currentKey === media.key}
              onPressedChange={() => showMedia(media.key)}
            >
              <OptimizedImage alt="" fill file={project.heroImage} sizes="72px" />
            </Toggle>
          )
        })}
      </div>
    </div>
  )
}
