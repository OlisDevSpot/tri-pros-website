'use client'

import { usePressFeedback } from '@/shared/hooks/use-press-feedback'

export function PressFeedbackProvider() {
  usePressFeedback()
  return null
}
