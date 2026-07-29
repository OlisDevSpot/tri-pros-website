import { BlockActions } from '@/shared/components/block/block-actions'
import { BlockBody } from '@/shared/components/block/block-body'
import { BlockContent } from '@/shared/components/block/block-content'
import { BlockDecor } from '@/shared/components/block/block-decor'
import { BlockDivider } from '@/shared/components/block/block-divider'
import { BlockEyebrow } from '@/shared/components/block/block-eyebrow'
import { BlockHeadline } from '@/shared/components/block/block-headline'
import { BlockMedia } from '@/shared/components/block/block-media'
import { BlockRoot } from '@/shared/components/block/block-root'
import { BlockTrust } from '@/shared/components/block/block-trust'

/**
 * Marketing/content block compound. Flat names are the source of truth; the
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
