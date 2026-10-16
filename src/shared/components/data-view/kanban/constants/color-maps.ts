import { STAGE_COLOR_TONE, TONE_CLASSES } from '@/shared/constants/status-tones'

export const stageColorMap: Record<string, string> = Object.fromEntries(
  Object.entries(STAGE_COLOR_TONE).map(([color, tone]) => [color, TONE_CLASSES[tone].bar]),
)

export const badgeColorMap: Record<string, string> = Object.fromEntries(
  Object.entries(STAGE_COLOR_TONE).map(([color, tone]) => [color, TONE_CLASSES[tone].fill]),
)
