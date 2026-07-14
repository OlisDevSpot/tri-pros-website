/**
 * Add approved "during" photos to an EXISTING portfolio project.
 *
 * The during-photos pipeline (.claude/skills/during-photos/SKILL.md) decorates
 * existing projects — it never creates them. After Oliver picks winners from
 * his Downloads, this script converts each image to webp, uploads it to R2
 * under the project's during bucket, and inserts the mediaFiles row.
 *
 * Usage: pnpm tsx scripts/add-during-media.ts <accessor> <file...>
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import './lib/load-env'
import { desc, eq } from 'drizzle-orm'
import sharp from 'sharp'
import { db } from '@/shared/db'
import { mediaFiles, projects } from '@/shared/db/schema'
import { r2Client } from '@/shared/services/providers/r2/client'
import { R2_BUCKETS, R2_PUBLIC_DOMAINS } from '@/shared/services/providers/r2/types'

const BUCKET = R2_BUCKETS.portfolioProjects
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
    .select({ sortOrder: mediaFiles.sortOrder })
    .from(mediaFiles)
    .where(eq(mediaFiles.projectId, project.id))
    .orderBy(desc(mediaFiles.sortOrder))
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
    const pathKey = `projects/${project.id}/during/${fileId}.webp`

    await r2Client.putObject(BUCKET, pathKey, webp, 'image/webp')

    await db.insert(mediaFiles).values({
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

    console.log(`  + during/${fileId}.webp  (${path.basename(file)})`)
  }

  process.exit(0)
}

main()
