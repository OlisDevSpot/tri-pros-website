/**
 * Add approved "during" photos to an EXISTING portfolio project.
 *
 * The during-photos pipeline (.claude/skills/during-photos/SKILL.md) decorates
 * existing projects — it never creates them. After Oliver picks winners from
 * his Downloads, this script converts each image to webp, uploads it to R2
 * under the project's during bucket, and inserts the projectMediaFiles row.
 *
 * Usage: pnpm tsx scripts/add-during-media.ts <accessor> <file...>
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import './lib/load-env'
import { desc, eq } from 'drizzle-orm'
import sharp from 'sharp'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { projectMediaFiles, projects } from '@/shared/db/schema'
import { projectMediaCrud } from '@/shared/modules/projects/media/dal/server/crud'
import { projectMediaStore } from '@/shared/modules/projects/media/store'
import { r2Client } from '@/shared/services/providers/r2/client'
import { R2_BUCKETS, R2_PUBLIC_DOMAINS } from '@/shared/services/providers/r2/types'

const BUCKET = R2_BUCKETS.media
const PUBLIC_BASE = R2_PUBLIC_DOMAINS[BUCKET] ?? ''

async function main() {
  const [accessor, ...files] = process.argv.slice(2)

  if (!accessor || files.length === 0) {
    console.error('Usage: pnpm tsx scripts/add-during-media.ts <accessor> <file...>')
    process.exit(1)
  }

  const [project] = await db.select().from(projects).where(eq(projects.accessor, accessor)).limit(1)
  if (!project) {
    console.error(`No project with accessor "${accessor}" — this script never creates projects.`)
    process.exit(1)
  }

  const [last] = await db
    .select({ sortOrder: projectMediaFiles.sortOrder })
    .from(projectMediaFiles)
    .where(eq(projectMediaFiles.projectId, project.id))
    .orderBy(desc(projectMediaFiles.sortOrder))
    .limit(1)
  let sortOrder = (last?.sortOrder ?? -1) + 1

  console.log(`Project: "${project.title}" (${project.id})`)

  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.error(`  Missing file, skipped: ${file}`)
      continue
    }

    const webp = await sharp(file).webp({ quality: 82 }).toBuffer()
    const fileId = crypto.randomUUID()
    const pathKey = projectMediaStore.buildPathKey(project.id, fileId, '.webp', { phase: 'during' })

    await r2Client.putObject(BUCKET, pathKey, webp, 'image/webp')

    const created = await projectMediaCrud.create(SYSTEM_CONTEXT, {
      name: path.basename(file),
      pathKey,
      bucket: BUCKET,
      mimeType: 'image/webp',
      fileExtension: 'webp',
      url: `${PUBLIC_BASE}/${pathKey}`,
      phase: 'during',
      isHeroImage: false,
      sortOrder: sortOrder++,
      projectId: project.id,
    })
    if (!created.success) {
      // R2 upload already happened — an orphaned object with no DB row is worse
      // than stopping here, so abort the run instead of logging and continuing
      // (matches the pre-hook behavior, when a raw `db.insert` threw on failure).
      throw new Error(`insert failed for ${path.basename(file)}: ${created.error.type}`)
    }

    console.log(`  + during/${fileId}.webp  (${path.basename(file)})`)
  }

  // No `process.exit(0)` here: the create hook's `void optimizeMediaJob.dispatch(...)`
  // (fire-and-forget QStash publish) would race a forced exit and can lose the
  // last iteration's dispatch. Close the pool explicitly instead so the process
  // still exits on its own once that dispatch settles.
  await db.$client.end()
}

main()
