import { CheckIcon } from 'lucide-react'

interface CheckListProps {
  items: string[]
}

/** What the homeowner can count on, one accent check per line. The agent and team slides share it, so their lists match (U13). */
export function CheckList({ items }: CheckListProps) {
  return (
    <ul className="grid gap-presentation-tight text-presentation-body text-white/85">
      {items.map(item => (
        <li key={item} className="flex items-start gap-[0.6em]">
          <CheckIcon aria-hidden className="mt-[0.2em] size-[1em] shrink-0 text-(--presentation-accent)" />
          {item}
        </li>
      ))}
    </ul>
  )
}
