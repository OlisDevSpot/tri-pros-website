import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

// The resolved roof names its form; anything but low-slope (including none resolved yet) draws as the gable.
export function homeRoofForm(form: string | null | undefined): RoofForm {
  return form === 'low-slope' ? 'low-slope' : 'pitched'
}
