import type { MotionValue } from 'motion/react'
import LogoDarkInk from '@public/company/logo/logo-light-right.svg'
import { Phone } from 'lucide-react'
import { motion, useTransform } from 'motion/react'
import Image from 'next/image'
import { contactInfo } from '@/shared/constants/company'
import { toDialString } from '@/shared/lib/phone'

/**
 * Slim sticky bar pinned to the top of the viewport for the whole funnel. On
 * the landing its `opacity` is driven by the hero scroll (cross-fading in as
 * the big hero logo fades out); on later steps the engine passes a constant
 * `1` MotionValue so the bar is simply always present. Mounted at the engine
 * root — above the transformed `motion.div` wrappers — so `position: fixed`
 * stays anchored to the viewport rather than a transformed containing block.
 *
 * Logo note: the funnel is scoped-light, so we hardcode the dark-ink
 * `logo-light-right.svg` (the artwork meant for light backgrounds) rather than
 * the shared Logo component, which switches on `dark:`. Same asset as the hero.
 */
export function FunnelStickyHeader({ opacity, widthClass = 'max-w-xl' }: { opacity: MotionValue<number>, widthClass?: string }) {
  const phone = contactInfo.find(c => c.accessor === 'phone')?.value ?? ''
  // Don't leave an invisible tap target floating over content when faded out.
  const pointerEvents = useTransform(opacity, v => (v < 0.1 ? 'none' : 'auto'))

  return (
    <motion.div
      style={{ opacity, pointerEvents }}
      className="border-border bg-card fixed inset-x-0 top-0 z-50 h-12 border-b shadow-sm"
    >
      {/* widthClass mirrors the page's content rail (set by the engine per step)
          so the logo + Call always line up with the content edges below them. */}
      <div className={`mx-auto flex h-full items-center justify-between px-5 ${widthClass}`}>
        <Image src={LogoDarkInk} alt="Tri Pros Remodeling" width={120} height={32} priority className="h-7 w-auto" />
        {phone
          ? (
              <a
                href={`tel:${toDialString(phone)}`}
                className="text-foreground hover:text-primary flex h-11 items-center gap-1.5 text-sm font-medium transition-colors"
              >
                <Phone className="size-4" />
                Call
              </a>
            )
          : null}
      </div>
    </motion.div>
  )
}
