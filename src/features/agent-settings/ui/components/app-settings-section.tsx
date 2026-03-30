'use client'

import { MoonIcon, SunIcon, SunMoonIcon } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Label } from '@/shared/components/ui/label'

export function AppSettingsSection() {
  const { theme, setTheme } = useTheme()

  return (
    <Card>
      <CardHeader>
        <CardTitle>App Settings</CardTitle>
        <CardDescription>Customize your dashboard experience.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Theme</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={theme === 'light' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTheme('light')}
            >
              <SunIcon className="size-4" />
              Light
            </Button>
            <Button
              type="button"
              variant={theme === 'dark' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTheme('dark')}
            >
              <MoonIcon className="size-4" />
              Dark
            </Button>
            <Button
              type="button"
              variant={theme === 'system' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTheme('system')}
            >
              <SunMoonIcon className="size-4" />
              System
            </Button>
          </div>
        </div>
        <div className="space-y-2 opacity-50">
          <Label>Notifications</Label>
          <p className="text-sm text-muted-foreground">Notification preferences coming soon.</p>
        </div>
      </CardContent>
    </Card>
  )
}
