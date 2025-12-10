'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import * as React from 'react'

import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="outline"
      aria-label="Toggle dark mode"
      size="icon"
      className="w-12 h-12"
      onClick={() => {
        setTheme(theme === 'light' ? 'dark' : 'light')
      }}
    >
      <Sun className="dark:hidden not-dark:block" />
      <Moon className="dark:block not-dark:hidden" />
    </Button>
  )
}
