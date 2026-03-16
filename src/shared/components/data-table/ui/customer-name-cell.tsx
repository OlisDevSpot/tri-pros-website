'use client'

interface Props {
  customerId: string | null
  customerName: string | null
  onViewProfile?: (customerId: string) => void
}

export function CustomerNameCell({ customerId, customerName, onViewProfile }: Props) {
  if (!customerId || !onViewProfile) {
    return (
      <span className="text-sm text-muted-foreground truncate max-w-40 block">
        {customerName ?? '—'}
      </span>
    )
  }

  return (
    <button
      type="button"
      className="text-sm text-muted-foreground truncate max-w-40 block hover:text-foreground hover:underline cursor-pointer"
      onClick={(e) => {
        e.stopPropagation()
        onViewProfile(customerId)
      }}
    >
      {customerName ?? '—'}
    </button>
  )
}
