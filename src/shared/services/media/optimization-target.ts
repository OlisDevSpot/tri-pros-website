// src/shared/services/media/optimization-target.ts
import type { MediaOwnerKind } from './stores'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { mediaFiles } from '@/shared/db/schema/media-files'
import { proposalMediaFiles } from '@/shared/db/schema/proposal-media-files'

export interface OptimizationTarget {
  table: any // contained generic base-media table (rule is off repo-wide)
  getFile: (id: number) => Promise<any> // row shape varies by owner
}

const targets: Record<MediaOwnerKind, OptimizationTarget> = {
  project: {
    table: mediaFiles,
    getFile: async id => (await db.select().from(mediaFiles).where(eq(mediaFiles.id, id)))[0],
  },
  proposal: {
    table: proposalMediaFiles,
    getFile: async id => (await db.select().from(proposalMediaFiles).where(eq(proposalMediaFiles.id, id)))[0],
  },
}

export function getOptimizationTarget(ownerKind: MediaOwnerKind): OptimizationTarget {
  return targets[ownerKind]
}
