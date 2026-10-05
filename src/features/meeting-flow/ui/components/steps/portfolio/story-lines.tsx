import type { ProjectStoryLine } from '@/shared/modules/projects/core/types'

interface StoryLinesProps {
  lines: ProjectStoryLine[]
}

export function StoryLines({ lines }: StoryLinesProps) {
  if (lines.length === 0) {
    return null
  }
  return (
    // Long stories scroll here rather than pushing the phase bar under the capsule.
    <div className="grid max-h-[28cqh] gap-presentation-tight overflow-y-auto overscroll-contain pr-2 [text-shadow:0_1px_8px_rgb(0_0_0/0.6)]">
      {lines.map(line => (
        <p key={line.part} className="text-presentation-body leading-snug text-white">
          <span className="block text-presentation-label font-bold tracking-widest text-(--presentation-accent) uppercase">{line.label}</span>
          {line.text}
        </p>
      ))}
    </div>
  )
}
