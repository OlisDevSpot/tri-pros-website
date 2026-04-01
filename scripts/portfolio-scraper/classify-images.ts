import type { ImagePhase, PhaseClassification } from './types'
import fs from 'node:fs'
import path from 'node:path'
import { openai } from '@ai-sdk/openai'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { mediaPhases } from '@/shared/constants/enums/media'
import { CLASSIFY_SYSTEM_PROMPT } from './constants'

const BATCH_SIZE = 4

const classificationSchema = z.object({
  classifications: z.array(z.object({
    index: z.number(),
    phase: z.enum(['hero', ...mediaPhases]),
  })),
})

async function classifyBatch(
  imagePaths: string[],
  imageDir: string,
  startIndex: number,
): Promise<PhaseClassification[]> {
  const imageContents = imagePaths.map((filename, idx) => {
    const filepath = path.join(imageDir, filename)
    const buffer = fs.readFileSync(filepath)
    const base64 = buffer.toString('base64')
    const ext = path.extname(filename).slice(1)
    const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`

    return {
      type: 'image' as const,
      image: `data:${mimeType};base64,${base64}`,
    }
  })

  const prompt = `Classify these ${imagePaths.length} images (indexed ${startIndex} to ${startIndex + imagePaths.length - 1}). Each image corresponds to its index in order.`

  const { output } = await generateText({
    model: openai('gpt-4o'),
    system: CLASSIFY_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...imageContents,
        ],
      },
    ],
    output: Output.object({
      schema: classificationSchema,
    }),
  })

  if (!output) {
    console.warn('  [WARN] Classification batch returned no output, defaulting to "uncategorized"')
    return imagePaths.map(filename => ({ filename, phase: 'uncategorized' as ImagePhase }))
  }

  return output.classifications.map((c, idx) => ({
    filename: imagePaths[idx],
    phase: c.phase,
  }))
}

export async function classifyImages(
  filenames: string[],
  imageDir: string,
): Promise<Record<string, ImagePhase>> {
  console.log(`  Classifying ${filenames.length} images with GPT-4o vision...`)

  const allClassifications: PhaseClassification[] = []

  for (let i = 0; i < filenames.length; i += BATCH_SIZE) {
    const batch = filenames.slice(i, i + BATCH_SIZE)
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(filenames.length / BATCH_SIZE)}...`)

    const results = await classifyBatch(batch, imageDir, i)
    allClassifications.push(...results)
  }

  // Ensure only one hero — pick the first, downgrade others to "after"
  let heroFound = false
  for (const c of allClassifications) {
    if (c.phase === 'hero') {
      if (heroFound) {
        c.phase = 'after'
      }
      else {
        heroFound = true
      }
    }
  }

  // Rename files with phase prefix
  const phaseMap: Record<string, ImagePhase> = {}
  const phaseCounts: Record<string, number> = {}

  for (const c of allClassifications) {
    const count = (phaseCounts[c.phase] || 0) + 1
    phaseCounts[c.phase] = count

    const ext = path.extname(c.filename)
    const paddedCount = String(count).padStart(3, '0')
    const newFilename = `${c.phase}_${paddedCount}${ext}`

    const oldPath = path.join(imageDir, c.filename)
    const newPath = path.join(imageDir, newFilename)

    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath)
    }

    phaseMap[newFilename] = c.phase
  }

  return phaseMap
}
