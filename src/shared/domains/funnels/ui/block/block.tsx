import { BlockActions } from '@/shared/domains/funnels/ui/block/block-actions'
import { BlockBody } from '@/shared/domains/funnels/ui/block/block-body'
import { BlockContent } from '@/shared/domains/funnels/ui/block/block-content'
import { BlockDecor } from '@/shared/domains/funnels/ui/block/block-decor'
import { BlockDivider } from '@/shared/domains/funnels/ui/block/block-divider'
import { BlockEyebrow } from '@/shared/domains/funnels/ui/block/block-eyebrow'
import { BlockHeadline } from '@/shared/domains/funnels/ui/block/block-headline'
import { BlockMedia } from '@/shared/domains/funnels/ui/block/block-media'
import { BlockRoot } from '@/shared/domains/funnels/ui/block/block-root'
import { BlockTrust } from '@/shared/domains/funnels/ui/block/block-trust'

/**
 * Funnel marketing block compound. Flat names are the source of truth; the
 * dot-notation namespace is attached here. Safe to dot from a Server Component
 * because BlockRoot + every slot are RSC-safe (no 'use client', no client imports).
 */
export const Block = Object.assign(BlockRoot, {
  Content: BlockContent,
  Decor: BlockDecor,
  Divider: BlockDivider,
  Eyebrow: BlockEyebrow,
  Headline: BlockHeadline,
  Body: BlockBody,
  Media: BlockMedia,
  Trust: BlockTrust,
  Actions: BlockActions,
})

export { BlockActions, BlockBody, BlockContent, BlockDecor, BlockDivider, BlockEyebrow, BlockHeadline, BlockMedia, BlockRoot, BlockTrust }
