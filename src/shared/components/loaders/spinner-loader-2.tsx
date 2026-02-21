import { Loader2 } from 'lucide-react'

export function SpinnerLoader2({ size }: { size?: number } = { size: 5 }) {
  return (
    <Loader2 size={size} className="mr-2 animate-spin" />
  )
}
