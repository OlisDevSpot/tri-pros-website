import type { CameraFraming } from '@/shared/components/scene/types'

export interface CameraGoalState {
  framingKey: string
  recenters: number
  // The last double-tap folded in, so a request held across renders lands once.
  doubleTapId: number
  doubleTap: CameraFraming | null
}

export interface DoubleTapRequest {
  id: number
  goal: CameraFraming
}

export interface CameraGoalEvent {
  framingKey: string
  recenters: number
  doubleTap: DoubleTapRequest | null
}

// Compared by value: the framing prop is rebuilt on every render, so identity would drop a glide on each press.
export function cameraFramingKey(framing: CameraFraming): string {
  return `${framing.position.join(',')}|${framing.target.join(',')}|${framing.fov}`
}

// An equal render changes nothing because every press re-renders the rig and StrictMode re-runs effects. A framing change
// in the same render as a double-tap wins and spends it: the app taking the camera (a roof tap going up close) outranks a look.
export function cameraGoal(state: CameraGoalState, event: CameraGoalEvent): { state: CameraGoalState, resetMoved: boolean } {
  const reframed = event.framingKey !== state.framingKey || event.recenters !== state.recenters
  const request = event.doubleTap !== null && event.doubleTap.id !== state.doubleTapId ? event.doubleTap : null
  if (reframed) {
    return {
      state: { framingKey: event.framingKey, recenters: event.recenters, doubleTapId: request?.id ?? state.doubleTapId, doubleTap: null },
      resetMoved: true,
    }
  }
  if (request) {
    return { state: { ...state, doubleTapId: request.id, doubleTap: request.goal }, resetMoved: false }
  }
  return { state, resetMoved: false }
}
