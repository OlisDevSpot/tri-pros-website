import { ChevronsDownUpIcon, ChevronsUpDownIcon } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'

interface Props {
  allOpen: boolean
  onToggle: () => void
}

export function ScopePhasesToggle({ allOpen, onToggle }: Props) {
  const Icon = allOpen ? ChevronsDownUpIcon : ChevronsUpDownIcon
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onToggle}
      aria-label={allOpen ? 'Collapse all phases' : 'Expand all phases'}
      className="relative h-7 gap-1 px-2.5 text-xs pointer-coarse:after:absolute pointer-coarse:after:-inset-1 pointer-coarse:after:content-['']"
    >
      <Icon className="size-3.5" aria-hidden />
      {allOpen ? 'Collapse all' : 'Expand all'}
    </Button>
  )
}
