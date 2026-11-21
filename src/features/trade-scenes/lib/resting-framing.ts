import type { CameraFraming } from '@/shared/components/scene/types'

interface RestingFramingInput {
  focus: CameraFraming | null
  held: CameraFraming | null
  home: CameraFraming
  recentered: boolean
}

interface RestingFraming {
  framing: CameraFraming
  held: CameraFraming | null
  away: boolean
}

// Letting a system go leaves the camera where Focus put it, so nothing glides; only Recenter sends it home. A Focus pressed
// again wins over the recenter bump it makes itself, since Focus recenters first and frames after.
export function restingFraming({ focus, held, home, recentered }: RestingFramingInput): RestingFraming {
  if (focus) {
    return { framing: focus, held: focus, away: false }
  }
  if (held && !recentered) {
    return { framing: held, held, away: true }
  }
  return { framing: home, held: null, away: false }
}
