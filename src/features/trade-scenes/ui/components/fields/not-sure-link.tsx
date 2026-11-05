import { PROFILE_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { Button } from '@/shared/components/ui/button'

interface NotSureLinkProps {
  pressed: boolean
  onPress: () => void
}

// Quiet on purpose: not knowing is the fallback, so it must not compete with the real choices. The hit area reaches past
// the text to a full 44 px without growing the label row, upward only: the field's own control sits just below, and its
// hit area needs those pixels to reach 44 px too.
export function NotSureLink({ pressed, onPress }: NotSureLinkProps) {
  return (
    <Button
      type="button"
      variant="link"
      aria-pressed={pressed}
      onClick={onPress}
      className="relative h-auto min-h-7 rounded-sm px-1 py-0.5 text-xs font-bold text-muted-foreground underline decoration-dotted underline-offset-3 after:absolute after:inset-x-0 after:-top-4 after:bottom-0 hover:text-foreground aria-pressed:text-(--presentation-accent)"
    >
      {PROFILE_COPY.unknown}
    </Button>
  )
}
