import type { ZipStep } from '@/shared/domains/funnels/types'

/** Importable prebuilt step (Seam A). Spread + override `content` to customize per funnel. */
export const ZIP_STEP: ZipStep = {
  id: 'zip',
  kind: 'zip',
  content: {
    title: 'Where is your home?',
    subtitle: 'We select Showcase homes by area.',
    inputCta: 'Check my area',
    serviceableLabel: 'Looks like we service',
    checkingLabel: 'Checking availability in {zip}…',
    qualifiesLabel: 'Looks like there\'s still availability in',
    outOfAreaLabel: 'We don\'t serve your area yet — try a different ZIP.',
    notFoundLabel: 'We couldn\'t find that ZIP — double-check it.',
  },
}
