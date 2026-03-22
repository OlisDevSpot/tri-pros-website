/**
 * Before/After Photo Matching Script
 *
 * For each project with both "before" and "after" photos, sends all image URLs
 * to GPT-4o Vision and asks it to identify matching pairs based on:
 *   - Camera angle / perspective
 *   - Room or area of the house
 *   - Architectural features (windows, doors, fixtures, layout)
 *   - Evidence of transformation (same space, different state)
 *
 * Results are stored in the `before_after_pairs_json` JSONB column on `projects`.
 *
 * Usage:
 *   npx tsx scripts/match-before-after.ts               # all qualifying projects
 *   npx tsx scripts/match-before-after.ts --dry-run      # preview without saving
 *   npx tsx scripts/match-before-after.ts --project <id> # single project
 */
import 'dotenv/config'
import { openai } from '@ai-sdk/openai'
import { generateText, Output } from 'ai'
import { and, count, eq, inArray, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { z } from 'zod'
import { mediaFiles, projects } from '@/shared/db/schema'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DRY_RUN = process.argv.includes('--dry-run')
const SINGLE_PROJECT = (() => {
  const idx = process.argv.indexOf('--project')
  return idx !== -1 ? process.argv[idx + 1] : null
})()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool)

// ---------------------------------------------------------------------------
// GPT-4o Vision schema for structured output
// ---------------------------------------------------------------------------

const matchResultSchema = z.object({
  pairs: z.array(z.object({
    beforeIndex: z.number().describe('Index of the before image (0-based, from the before array)'),
    afterIndex: z.number().describe('Index of the after image (0-based, from the after array)'),
    label: z.string().describe('Short label for what area/room this pair shows, e.g. "Kitchen", "Master Bath", "Front Exterior"'),
    confidence: z.number().min(0).max(1).describe('How confident you are this is the same space/angle (0.0 = guess, 1.0 = certain)'),
    reasoning: z.string().describe('Brief explanation of why these match — what visual cues connect them'),
  })),
})

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert at analyzing residential construction/remodeling photos.

Your task: given a set of BEFORE photos and AFTER photos from the same remodeling project, identify which before photos match which after photos — meaning they show the SAME space or area of the house, just in different states (before vs after remodeling).

## How to Match

Look for these visual cues to identify matching pairs:
1. **Camera angle & perspective**: Same vantage point, similar framing
2. **Room layout & shape**: Same room dimensions, window placement, door positions
3. **Architectural features**: Matching window shapes, ceiling lines, floor plan
4. **Fixed elements**: Things that don't change in a remodel — structural walls, window openings, ceiling height, room proportions
5. **Spatial context**: Adjacent rooms visible, hallway connections, exterior landmarks

## Rules
- A before photo can match AT MOST one after photo (1:1 pairing)
- An after photo can match AT MOST one before photo
- Only report pairs where you have reasonable confidence (>= 0.5)
- It's better to miss a pair than to report a false match
- If the same space has multiple angles, match each angle separately
- Label each pair with a descriptive room/area name
- For exterior shots, note which side of the house (front, back, side)

## Output
Return a JSON object with a "pairs" array. Each pair has:
- beforeIndex: index into the before images array (0-based)
- afterIndex: index into the after images array (0-based)
- label: short area/room label
- confidence: 0.0-1.0
- reasoning: brief explanation of matching visual cues`

// ---------------------------------------------------------------------------
// Core matching function — with batching for large projects
// ---------------------------------------------------------------------------

/** Max images per API call. ~8 before + ~10 after stays well under 30K TPM. */
const MAX_BEFORE_PER_BATCH = 8
const MAX_AFTER_PER_BATCH = 10
/** Delay between batches to respect rate limits (ms) */
const BATCH_DELAY_MS = 3000

interface PhotoRow {
  id: number
  url: string
  phase: string
  name: string
}

interface MatchPair {
  beforeMediaId: number
  afterMediaId: number
  label: string
  confidence: number
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Send a single batch of before + after photos to GPT-4o Vision.
 * beforeSlice and afterSlice are subsets of the full arrays.
 * beforeOffset/afterOffset track their position in the full arrays (for logging only).
 */
async function matchBatch(
  projectTitle: string,
  beforeSlice: PhotoRow[],
  afterSlice: PhotoRow[],
  batchLabel: string,
): Promise<MatchPair[]> {
  const beforeImageBlocks = beforeSlice.map((photo, i) => ([
    { type: 'text' as const, text: `[BEFORE #${i}] ${photo.name}` },
    { type: 'image' as const, image: photo.url },
  ])).flat()

  const afterImageBlocks = afterSlice.map((photo, i) => ([
    { type: 'text' as const, text: `[AFTER #${i}] ${photo.name}` },
    { type: 'image' as const, image: photo.url },
  ])).flat()

  const prompt = [
    `Project: "${projectTitle}" — ${batchLabel}.`,
    `I have ${beforeSlice.length} BEFORE photos and ${afterSlice.length} AFTER photos.`,
    `Identify matching pairs showing the same space before and after remodeling.`,
    ``,
    `--- BEFORE PHOTOS ---`,
  ].join('\n')

  const { output } = await generateText({
    model: openai('gpt-4o'),
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...beforeImageBlocks,
          { type: 'text', text: '\n--- AFTER PHOTOS ---' },
          ...afterImageBlocks,
        ],
      },
    ],
    output: Output.object({ schema: matchResultSchema }),
  })

  if (!output || output.pairs.length === 0) return []

  return output.pairs
    .filter(p =>
      p.beforeIndex >= 0
      && p.beforeIndex < beforeSlice.length
      && p.afterIndex >= 0
      && p.afterIndex < afterSlice.length
      && p.confidence >= 0.5,
    )
    .map(p => ({
      beforeMediaId: beforeSlice[p.beforeIndex].id,
      afterMediaId: afterSlice[p.afterIndex].id,
      label: p.label,
      confidence: Math.round(p.confidence * 100) / 100,
    }))
}

async function matchProject(
  projectId: string,
  projectTitle: string,
  beforePhotos: PhotoRow[],
  afterPhotos: PhotoRow[],
) {
  console.log(`\n--- ${projectTitle} (${projectId.slice(0, 8)}) ---`)
  console.log(`  Before: ${beforePhotos.length} photos, After: ${afterPhotos.length} photos`)

  const needsBatching = beforePhotos.length > MAX_BEFORE_PER_BATCH || afterPhotos.length > MAX_AFTER_PER_BATCH

  if (needsBatching) {
    console.log(`  Large project — splitting into batches (${MAX_BEFORE_PER_BATCH} before x ${MAX_AFTER_PER_BATCH} after per batch)`)
  }

  // Split into batches
  const beforeChunks: PhotoRow[][] = []
  for (let i = 0; i < beforePhotos.length; i += MAX_BEFORE_PER_BATCH) {
    beforeChunks.push(beforePhotos.slice(i, i + MAX_BEFORE_PER_BATCH))
  }

  const afterChunks: PhotoRow[][] = []
  for (let i = 0; i < afterPhotos.length; i += MAX_AFTER_PER_BATCH) {
    afterChunks.push(afterPhotos.slice(i, i + MAX_AFTER_PER_BATCH))
  }

  const allPairs: MatchPair[] = []
  const usedBeforeIds = new Set<number>()
  const usedAfterIds = new Set<number>()
  let batchNum = 0
  const totalBatches = beforeChunks.length * afterChunks.length

  try {
    for (let bi = 0; bi < beforeChunks.length; bi++) {
      for (let ai = 0; ai < afterChunks.length; ai++) {
        batchNum++
        const label = totalBatches > 1
          ? `Batch ${batchNum}/${totalBatches} (before[${bi * MAX_BEFORE_PER_BATCH}..${bi * MAX_BEFORE_PER_BATCH + beforeChunks[bi].length - 1}] x after[${ai * MAX_AFTER_PER_BATCH}..${ai * MAX_AFTER_PER_BATCH + afterChunks[ai].length - 1}])`
          : 'All photos'

        if (batchNum > 1) {
          console.log(`  Waiting ${BATCH_DELAY_MS / 1000}s for rate limit...`)
          await sleep(BATCH_DELAY_MS)
        }

        console.log(`  ${label}...`)

        const batchPairs = await matchBatch(projectTitle, beforeChunks[bi], afterChunks[ai], label)

        // Deduplicate: enforce 1:1 mapping across batches
        for (const pair of batchPairs) {
          if (!usedBeforeIds.has(pair.beforeMediaId) && !usedAfterIds.has(pair.afterMediaId)) {
            allPairs.push(pair)
            usedBeforeIds.add(pair.beforeMediaId)
            usedAfterIds.add(pair.afterMediaId)
          }
        }
      }
    }

    if (allPairs.length === 0) {
      console.log('  No matches found.')
      return null
    }

    console.log(`  Found ${allPairs.length} matching pairs:`)
    for (const pair of allPairs) {
      const before = beforePhotos.find(p => p.id === pair.beforeMediaId)
      const after = afterPhotos.find(p => p.id === pair.afterMediaId)
      console.log(`    "${pair.label}" (${(pair.confidence * 100).toFixed(0)}%) — before:${before?.name} <-> after:${after?.name}`)
    }

    return { pairs: allPairs }
  }
  catch (err) {
    console.error(`  ERROR matching project: ${err instanceof Error ? err.message : err}`)
    // If we got partial results before the error, still return them
    if (allPairs.length > 0) {
      console.log(`  Returning ${allPairs.length} partial pairs found before error.`)
      return { pairs: allPairs }
    }
    return null
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Before/After Photo Matcher ===')
  if (DRY_RUN) console.log('(DRY RUN — results will NOT be saved to DB)')

  // Step 1: Find qualifying projects
  const phaseRows = await db
    .select({
      projectId: mediaFiles.projectId,
      projectTitle: projects.title,
      phase: mediaFiles.phase,
      photoCount: count(mediaFiles.id),
    })
    .from(mediaFiles)
    .innerJoin(projects, eq(mediaFiles.projectId, projects.id))
    .where(
      and(
        inArray(mediaFiles.phase, ['before', 'after']),
        sql`${mediaFiles.mimeType} LIKE 'image/%'`,
      ),
    )
    .groupBy(mediaFiles.projectId, projects.title, mediaFiles.phase)

  const projectMap = new Map<string, { title: string, before: number, after: number }>()
  for (const row of phaseRows) {
    const existing = projectMap.get(row.projectId) ?? { title: row.projectTitle, before: 0, after: 0 }
    if (row.phase === 'before') existing.before = Number(row.photoCount)
    if (row.phase === 'after') existing.after = Number(row.photoCount)
    projectMap.set(row.projectId, existing)
  }

  let qualifying = [...projectMap.entries()].filter(([, v]) => v.before > 0 && v.after > 0)

  if (SINGLE_PROJECT) {
    qualifying = qualifying.filter(([id]) => id === SINGLE_PROJECT)
    if (qualifying.length === 0) {
      console.error(`Project ${SINGLE_PROJECT} not found or doesn't have both phases.`)
      await pool.end()
      process.exit(1)
    }
  }

  console.log(`\nFound ${qualifying.length} qualifying projects.\n`)

  // Step 2: Process each project
  let totalPairs = 0

  for (const [projectId, info] of qualifying) {
    // Fetch all before + after photos for this project
    const photos = await db
      .select({
        id: mediaFiles.id,
        url: mediaFiles.url,
        phase: mediaFiles.phase,
        name: mediaFiles.name,
        sortOrder: mediaFiles.sortOrder,
        createdAt: mediaFiles.createdAt,
      })
      .from(mediaFiles)
      .where(
        and(
          eq(mediaFiles.projectId, projectId),
          inArray(mediaFiles.phase, ['before', 'after']),
          sql`${mediaFiles.mimeType} LIKE 'image/%'`,
        ),
      )
      .orderBy(mediaFiles.sortOrder, mediaFiles.createdAt)

    const beforePhotos = photos.filter(p => p.phase === 'before') as PhotoRow[]
    const afterPhotos = photos.filter(p => p.phase === 'after') as PhotoRow[]

    const result = await matchProject(projectId, info.title, beforePhotos, afterPhotos)

    if (result && result.pairs.length > 0) {
      totalPairs += result.pairs.length

      if (!DRY_RUN) {
        await db
          .update(projects)
          .set({ beforeAfterPairsJSON: result })
          .where(eq(projects.id, projectId))
        console.log(`  Saved ${result.pairs.length} pairs to DB.`)
      }
    }
  }

  console.log(`\n=== Done! Total pairs found: ${totalPairs} ===`)
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
