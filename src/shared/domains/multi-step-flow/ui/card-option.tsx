'use client'

import type { ReactNode } from 'react'
import type { CardOption as CardOptionData, OptionAsset } from '../types'
import { motion } from 'motion/react'
import { cn } from '@/shared/lib/utils'
import { CARD_STAGGER_ITEM, CTA_HOVER, CTA_TAP } from '../constants/step-motion'

interface CardOptionProps {
  option: CardOptionData
  selected: boolean
  columns: 1 | 2
  onSelect: (id: string) => void
  /** Optional asset renderer. When absent, only label/description render. */
  renderAsset?: (asset: OptionAsset) => ReactNode
}

export function CardOption({ option, selected, columns, onSelect, renderAsset }: CardOptionProps) {
  return (
    <motion.button
      className={cn(
        'flex items-center gap-3 rounded-xl border p-4 text-left transition-colors',
        columns === 1 ? 'w-full' : 'w-full flex-col items-start',
        selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
      )}
      type="button"
      variants={CARD_STAGGER_ITEM}
      whileHover={CTA_HOVER}
      whileTap={CTA_TAP}
      onClick={() => onSelect(option.id)}
    >
      {option.asset && renderAsset ? renderAsset(option.asset) : null}
      <span className="flex flex-col">
        <span className="font-medium">{option.label}</span>
        {option.description ? <span className="text-sm text-muted-foreground">{option.description}</span> : null}
      </span>
    </motion.button>
  )
}
