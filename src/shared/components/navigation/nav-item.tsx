import type { MotionValue } from 'motion/react'
import type { NavItem as TNavItem } from '@/shared/types/nav'
import { ChevronUpIcon } from 'lucide-react'
import { animate, motion } from 'motion/react'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { useHasScrolled } from '@/shared/hooks/use-has-scrolled'
import { cn } from '@/shared/lib/utils'

interface Props {
  item: TNavItem
  index: number
  isActive: boolean
  onClick?: () => void
  onMouseEnter: () => void
  selectedItemIndex: number | null
  width?: MotionValue<number>
  left?: MotionValue<number>
}

export function NavItem({
  item,
  index,
  isActive,
  onClick,
  onMouseEnter,
  selectedItemIndex,
  width,
  left,
}: Props) {
  const scrolled = useHasScrolled(10)
  const buttonRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!left || !width || !buttonRef.current || selectedItemIndex !== index)
      return

    const clientRect = buttonRef.current.getBoundingClientRect()
    const containerLeft = document.getElementById('nav-items-container')?.getBoundingClientRect()!.left as number

    animate(width, clientRect.width)
    animate(left, clientRect.x - containerLeft)
  }, [selectedItemIndex, index, left, width])

  return (
    <motion.div
      ref={buttonRef}
      key={item.name}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      onMouseEnter={onMouseEnter}
      onClick={() => {
        onClick?.()
      }}
    >
      <Link
        href={item.action === 'readonly' ? '#' : item.href}
        className={cn(
          'relative inline-block px-6 py-3 2xl:px-8 2xl:py-4 hover:text-foreground/70 transition-colors duration-200 font-medium',
          scrolled ? 'text-foreground' : 'text-foreground',
          isActive ? 'text-primary hover:text-primary' : '',
          item.action === 'readonly' && 'cursor-default',
        )}
      >
        <div className="flex gap-2 items-center w-fit">
          {item.name}
          {item.subItems && item.subItems.length > 0 && (
            <ChevronUpIcon
              className={cn(
                'size-4 transition-transform -mr-2',
                selectedItemIndex === index || isActive ? 'rotate-180' : '',
              )}
            />
          )}
        </div>
      </Link>
    </motion.div>
  )
}
