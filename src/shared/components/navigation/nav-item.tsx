import type { MotionValue } from 'motion/react'
import type { NavItem as TNavItem } from '@/shared/types/nav'
import { ChevronUpIcon } from 'lucide-react'
import { animate, motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { BRAND_EASE } from '@/shared/constants/motion'
import { useHasScrolled } from '@/shared/hooks/use-has-scrolled'
import { cn } from '@/shared/lib/utils'

interface Props {
  item: TNavItem
  index: number
  isActive: boolean
  onClick?: (e: React.MouseEvent) => void
  onPointerEnter?: (e: React.PointerEvent) => void
  onPointerDown?: (e: React.PointerEvent) => void
  expanded?: boolean
  selectedItemIndex: number | null
  width?: MotionValue<number>
  left?: MotionValue<number>
  animateEntrance?: boolean
}

export function NavItem({
  item,
  index,
  isActive,
  onClick,
  onPointerEnter,
  onPointerDown,
  expanded,
  selectedItemIndex,
  width,
  left,
  animateEntrance = true,
}: Props) {
  const scrolled = useHasScrolled(10)
  const reduceMotion = useReducedMotion()
  const buttonRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!left || !width || !buttonRef.current || selectedItemIndex !== index)
      return

    const clientRect = buttonRef.current.getBoundingClientRect()
    const containerLeft = document.getElementById('nav-items-container')?.getBoundingClientRect()!.left as number

    const x = clientRect.x - containerLeft
    if (width.get() === 0 || reduceMotion)
      left.jump(x)
    animate(width, clientRect.width, { duration: 0.18, ease: BRAND_EASE })
    animate(left, x, { duration: 0.18, ease: BRAND_EASE })
  }, [selectedItemIndex, index, left, width, reduceMotion])

  return (
    <motion.div
      ref={buttonRef}
      key={item.name}
      initial={animateEntrance ? { opacity: 0, y: reduceMotion ? 0 : -20 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'tween', ease: BRAND_EASE, duration: 0.4, delay: index * 0.1 }}
      onPointerEnter={onPointerEnter}
      onPointerDown={onPointerDown}
      onClick={(e) => {
        onClick?.(e)
      }}
      className="w-full min-w-fit"
    >
      {item.action === 'readonly'
        ? (
            <button
              type="button"
              aria-expanded={item.subItems.length > 0 ? expanded : undefined}
              className={cn(
                'relative inline-block px-6 py-3 2xl:px-8 2xl:py-4 hover:text-foreground/70 transition-colors duration-200 font-medium cursor-default',
                scrolled ? 'text-foreground' : 'text-foreground',
                isActive ? 'text-primary hover:text-primary' : '',
              )}
            >
              <div className="flex gap-2 items-center w-fit">
                {item.name}
                {item.subItems.length > 0 && (
                  <ChevronUpIcon
                    className={cn(
                      'size-4 transition-transform -mr-2',
                      selectedItemIndex === index || isActive ? 'rotate-180' : '',
                    )}
                  />
                )}
              </div>
            </button>
          )
        : (
            <Link
              href={item.href}
              className={cn(
                'relative inline-block px-6 py-3 2xl:px-8 2xl:py-4 hover:text-foreground/70 transition-colors duration-200 font-medium',
                scrolled ? 'text-foreground' : 'text-foreground',
                isActive ? 'text-primary hover:text-primary' : '',
              )}
            >
              <div className="flex gap-2 items-center w-fit">
                {item.name}
              </div>
            </Link>
          )}
    </motion.div>
  )
}
