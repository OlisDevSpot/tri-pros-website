'use client'

import { ArrowLeftIcon } from 'lucide-react'

import { SCENE_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { SCENE_SHORTCUT_KEYS } from '@/features/trade-scenes/constants/scene-shortcuts'
import { keycapLabel } from '@/features/trade-scenes/lib/keycap-label'
import { Keycap } from '@/features/trade-scenes/ui/components/keycap'
import { Button } from '@/shared/components/ui/button'

interface BackToHomeButtonProps {
  onBack: () => void
}

export function BackToHomeButton({ onBack }: BackToHomeButtonProps) {
  return (
    <Button variant="outline" className="relative min-h-11" aria-keyshortcuts="Escape" onClick={onBack}>
      <ArrowLeftIcon aria-hidden />
      {SCENE_COPY.backToHome}
      {/* Raised over the button's top edge, so the cap never sits on the label. */}
      <Keycap keyLabel={keycapLabel(SCENE_SHORTCUT_KEYS.wholeHome)} className="-top-2 -right-2" />
    </Button>
  )
}
