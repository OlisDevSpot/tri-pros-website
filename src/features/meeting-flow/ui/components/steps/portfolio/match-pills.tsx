interface MatchPillsProps {
  labels: string[]
}

export function MatchPills({ labels }: MatchPillsProps) {
  if (labels.length === 0) {
    return null
  }
  return (
    <ul className="flex flex-wrap gap-presentation-tight">
      {labels.map(label => (
        <li key={label} className="rounded-full bg-(--presentation-accent) px-3 py-1 text-presentation-label font-semibold text-(--presentation-ground)">
          {label}
        </li>
      ))}
    </ul>
  )
}
