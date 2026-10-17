'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import * as React from 'react'

import { MotionButton } from '@/shared/components/buttons/motion-button'

interface Props extends React.HTMLAttributes<HTMLButtonElement> {
  className?: string
  animateIn?: boolean
}

export function ThemeToggleButton({ className, animateIn = true }: Props) {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <MotionButton
      variant="outline"
      aria-label="Toggle dark mode"
      initial={animateIn ? { opacity: 0, y: -20 } : false}
      animate={{ opacity: 1, y: 0 }}
      className={className}
      size="icon"
      // With the theme on "system", `theme` is "system", so the toggle reads the resolved one.
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="dark:hidden not-dark:block" />
      <Moon className="dark:block not-dark:hidden" />
    </MotionButton>
  )
}
