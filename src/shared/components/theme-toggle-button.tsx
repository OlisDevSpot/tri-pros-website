'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import * as React from 'react'

import { MotionButton } from '@/shared/components/buttons/motion-button'

interface Props extends React.HTMLAttributes<HTMLButtonElement> {
  className?: string
}

export function ThemeToggleButton({ className }: Props) {
  const { theme, setTheme } = useTheme()

  return (
    <MotionButton
      variant="outline"
      aria-label="Toggle dark mode"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
      size="icon"
      onClick={() => {
        setTheme(theme === 'light' ? 'dark' : 'light')
      }}
    >
      <Sun className="dark:hidden not-dark:block" />
      <Moon className="dark:block not-dark:hidden" />
    </MotionButton>
  )
}
