import type { ProjectStoryPhase } from '@/shared/modules/projects/core/types'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { cn } from '@/shared/lib/utils'

interface StoryPhaseBarProps {
  /** Null while the project's photos load. */
  storyPhases: ProjectStoryPhase[] | null
  phaseIndex: number
  photoIndex: number
  onSelect: (phaseIndex: number) => void
}

export function StoryPhaseBar({ storyPhases, phaseIndex, photoIndex, onSelect }: StoryPhaseBarProps) {
  if (!storyPhases) {
    return <Skeleton className="h-11 w-full bg-white/10" />
  }
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1.5">
      {storyPhases.map((storyPhase, index) => {
        const fill = index < phaseIndex ? 1 : index === phaseIndex ? (photoIndex + 1) / storyPhase.photos.length : 0
        const active = index === phaseIndex
        const count = storyPhase.photos.length
        return (
          <button
            key={storyPhase.phase}
            aria-current={active ? 'step' : undefined}
            aria-label={`${storyPhase.label}, ${count} ${count === 1 ? 'photo' : 'photos'}`}
            className={cn(
              'relative min-h-11 overflow-hidden rounded-md bg-white/12 px-3 text-left text-presentation-label font-bold tracking-[0.08em] text-white/80 uppercase',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
              active && 'text-white ring-1 ring-white/50',
            )}
            type="button"
            onClick={() => onSelect(index)}
          >
            <span aria-hidden className="absolute inset-0 origin-left bg-(--presentation-accent) transition-transform duration-300 motion-reduce:transition-none" style={{ transform: `scaleX(${fill})` }} />
            <span className={cn('relative', fill === 1 && 'text-(--presentation-ground)')}>{storyPhase.label}</span>
            <span className="relative ml-1.5 font-semibold tracking-normal normal-case opacity-80">{count}</span>
          </button>
        )
      })}
    </div>
  )
}
