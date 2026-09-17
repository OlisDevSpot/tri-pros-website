// src/shared/services/media/optimization-target.ts
import type { MediaOwnerKind } from './stores'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { projectMediaFiles } from '@/shared/db/schema/project-media-files'
import { proposalMediaFiles } from '@/shared/db/schema/proposal-media-files'

export interface OptimizationTarget {
  table: any // contained generic base-media table (rule is off repo-wide)
  getFile: (id: number) => Promise<any> // row shape varies by owner
}

const targets: Record<MediaOwnerKind, OptimizationTarget> = {
  project: {
    table: projectMediaFiles,
    getFile: async id => (await db.select().from(projectMediaFiles).where(eq(projectMediaFiles.id, id)))[0],
  },
  proposal: {
    table: proposalMediaFiles,
    getFile: async id => (await db.select().from(proposalMediaFiles).where(eq(proposalMediaFiles.id, id)))[0],
  },
}

export function getOptimizationTarget(ownerKind: MediaOwnerKind): OptimizationTarget {
  return targets[ownerKind]
}
