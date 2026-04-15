import type { MediaPhase } from '@/shared/constants/enums/media'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import readline from 'node:readline'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { mediaFiles, projects, x_projectScopes } from '@/shared/db/schema'
import { projectFormSchema } from '@/shared/entities/projects/schemas'
import { R2_BUCKETS, R2_PUBLIC_DOMAINS } from '@/shared/services/r2/buckets'
import { r2Client } from '@/shared/services/r2/client'
import { OUTPUT_BASE_DIR } from './constants'

const BUCKET = R2_BUCKETS.portfolioProjects
const R2_PUBLIC_BASE = R2_PUBLIC_DOMAINS[BUCKET] ?? ''
const IMPORTED_DIR = path.join(OUTPUT_BASE_DIR, 'imported')

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

interface AvailableProject {
  name: string
  hasJson: boolean
  imageCount: number
}

function getAvailableProjects(): AvailableProject[] {
  if (!fs.existsSync(OUTPUT_BASE_DIR))
    return []

  return fs.readdirSync(OUTPUT_BASE_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== 'imported')
    .map((d) => {
      const dir = path.join(OUTPUT_BASE_DIR, d.name)
      const hasJson = fs.existsSync(path.join(dir, 'project.json'))
      const imagesDir = path.join(dir, 'images')
      const imageCount = fs.existsSync(imagesDir)
        ? fs.readdirSync(imagesDir).filter(f => /\.(?:jpg|jpeg|png|webp)$/i.test(f)).length
        : 0
      return { name: d.name, hasJson, imageCount }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

function moveToImported(folderPath: string): void {
  const folderName = path.basename(folderPath)
  const dest = path.join(IMPORTED_DIR, folderName)

  fs.mkdirSync(IMPORTED_DIR, { recursive: true })

  // If destination already exists (e.g. re-run), remove it first
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true })
  }

  fs.renameSync(folderPath, dest)
  console.log(`  Moved to imported/${folderName}`)
}

function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

interface ParsedArgs {
  mode: 'single' | 'all'
  folderPaths: string[]
}

async function parseArgs(): Promise<ParsedArgs> {
  const arg = process.argv[2]

  if (arg === '--help' || arg === '-h') {
    console.log(`
Project Importer — Import scraped folder(s) into showroom

Usage:
  pnpm import-project [folder-name]
  pnpm import-project --all

Arguments:
  folder-name    Name of a folder inside _assets/portfolio-projects/
                 Or a full path. If omitted, shows an interactive picker.

Flags:
  --all          Import all projects that have a project.json (skips duplicates)

Examples:
  pnpm import-project aureate
  pnpm import-project --all
  pnpm import-project          # interactive picker
`)
    process.exit(0)
  }

  // --all mode: import every folder with a project.json
  if (arg === '--all') {
    const available = getAvailableProjects().filter(p => p.hasJson)

    if (available.length === 0) {
      console.error(`No importable projects found in ${OUTPUT_BASE_DIR}`)
      console.error('Run pnpm scrape-project first to create some.')
      process.exit(1)
    }

    return {
      mode: 'all',
      folderPaths: available.map(p => path.join(OUTPUT_BASE_DIR, p.name)),
    }
  }

  // Single folder by name or path
  if (arg) {
    const fromBase = path.join(OUTPUT_BASE_DIR, arg)
    const resolved = fs.existsSync(fromBase) ? fromBase : path.resolve(arg)

    if (!fs.existsSync(resolved)) {
      console.error(`Error: Folder not found: "${arg}"`)
      console.error(`  Checked: ${fromBase}`)
      console.error(`  Checked: ${path.resolve(arg)}`)
      process.exit(1)
    }
    return { mode: 'single', folderPaths: [resolved] }
  }

  // No argument — interactive picker
  const available = getAvailableProjects()

  if (available.length === 0) {
    console.error(`No project folders found in ${OUTPUT_BASE_DIR}`)
    console.error('Run pnpm scrape-project first to create one.')
    process.exit(1)
  }

  console.log('\nAvailable projects:\n')
  for (let i = 0; i < available.length; i++) {
    const p = available[i]
    const status = p.hasJson ? `${p.imageCount} images` : 'missing project.json'
    console.log(`  ${String(i + 1).padStart(2)}. ${p.name}  (${status})`)
  }

  const answer = await promptUser(`\nSelect project [1-${available.length}]: `)
  const index = Number.parseInt(answer, 10) - 1

  if (Number.isNaN(index) || index < 0 || index >= available.length) {
    console.error('Invalid selection.')
    process.exit(1)
  }

  return { mode: 'single', folderPaths: [path.join(OUTPUT_BASE_DIR, available[index].name)] }
}

function detectPhase(filename: string, phasesMap: Record<string, string> | null): MediaPhase {
  if (phasesMap && phasesMap[filename]) {
    const phase = phasesMap[filename]
    if (['before', 'during', 'after', 'uncategorized', 'hero'].includes(phase)) {
      return phase === 'hero' ? 'uncategorized' : phase as MediaPhase
    }
  }

  const lower = filename.toLowerCase()
  if (lower.startsWith('before'))
    return 'before'
  if (lower.startsWith('during'))
    return 'during'
  if (lower.startsWith('after'))
    return 'after'

  return 'uncategorized'
}

function isHeroFromPhases(filename: string, phasesMap: Record<string, string> | null): boolean {
  if (!phasesMap)
    return false
  return phasesMap[filename] === 'hero'
}

function getImageFiles(imagesDir: string): string[] {
  if (!fs.existsSync(imagesDir))
    return []

  return fs.readdirSync(imagesDir)
    .filter((f) => {
      const ext = path.extname(f).toLowerCase()
      return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext)
    })
    .sort()
}

async function uploadToR2(
  filePath: string,
  pathKey: string,
  mimeType: string,
): Promise<void> {
  const fileBuffer = fs.readFileSync(filePath)

  await r2Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: pathKey,
    Body: fileBuffer,
    ContentType: mimeType,
  }))
}

interface ImportResult {
  folder: string
  folderPath: string
  status: 'imported' | 'skipped' | 'failed'
  reason?: string
  projectId?: string
  accessor?: string
  imageCount?: number
  scopeCount?: number
}

async function importProject(folderPath: string): Promise<ImportResult> {
  const folderName = path.basename(folderPath)

  // 1. Read and validate project.json
  const projectJsonPath = path.join(folderPath, 'project.json')
  if (!fs.existsSync(projectJsonPath)) {
    return { folder: folderName, folderPath, status: 'failed', reason: 'missing project.json' }
  }

  const rawJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf-8'))
  const { notionScopeIds, scopeNames, ...projectData } = rawJson
  const scopeNameList: string[] = scopeNames ?? []

  // Use Notion scope IDs directly (stored as strings in x_projectScopes)
  const notionIds: string[] = notionScopeIds ?? []

  // Inject notionScopeIds as scopeIds for validation
  projectData.scopeIds = notionIds

  const parsed = projectFormSchema.safeParse(projectData)
  if (!parsed.success) {
    return { folder: folderName, folderPath, status: 'failed', reason: 'validation failed' }
  }

  const data = parsed.data
  console.log(`\n  Project: "${data.title}" (${data.accessor})`)
  console.log(`  City: ${data.city}, ${data.state || 'CA'}`)

  if (notionIds.length > 0) {
    console.log(`  Scopes: ${scopeNameList.join(', ')} (${notionIds.length} Notion IDs)`)
  }

  // Check for duplicate
  const [existing] = await db
    .select({ id: projects.id, accessor: projects.accessor })
    .from(projects)
    .where(eq(projects.accessor, data.accessor))
    .limit(1)

  if (existing) {
    console.log(`  Skipped — already exists (id: ${existing.id})`)
    return { folder: folderName, folderPath, status: 'skipped', reason: 'duplicate', accessor: data.accessor }
  }

  // Create project in Postgres
  const { scopeIds, ...insertData } = data

  const [project] = await db.insert(projects).values({
    ...insertData,
    state: insertData.state || 'CA',
  }).returning()

  if (scopeIds.length > 0) {
    await db.insert(x_projectScopes).values(
      scopeIds.map(scopeId => ({
        projectId: project.id,
        scopeId,
      })),
    )
    console.log(`  Linked ${scopeIds.length} scopes`)
  }
  else {
    console.log('  ⚠ No scopes linked')
  }

  // Upload images to R2
  const imagesDir = path.join(folderPath, 'images')
  const imageFiles = getImageFiles(imagesDir)

  const phasesJsonPath = path.join(folderPath, 'phases.json')
  const phasesMap: Record<string, string> | null = fs.existsSync(phasesJsonPath)
    ? JSON.parse(fs.readFileSync(phasesJsonPath, 'utf-8'))
    : null

  if (imageFiles.length === 0) {
    console.log('  No images found')
  }
  else {
    console.log(`  Uploading ${imageFiles.length} images...`)

    let heroSet = false

    for (let i = 0; i < imageFiles.length; i++) {
      const filename = imageFiles[i]
      const filePath = path.join(imagesDir, filename)
      const ext = path.extname(filename).toLowerCase()
      const mimeType = MIME_TYPES[ext] || 'image/jpeg'
      const phase = detectPhase(filename, phasesMap)
      const fileId = crypto.randomUUID()
      const pathKey = `projects/${project.id}/${phase}/${fileId}${ext}`
      const publicUrl = `${R2_PUBLIC_BASE}/${pathKey}`

      const isHero = !heroSet && (isHeroFromPhases(filename, phasesMap) || i === 0)
      if (isHero)
        heroSet = true

      await uploadToR2(filePath, pathKey, mimeType)

      await db.insert(mediaFiles).values({
        name: filename,
        pathKey,
        bucket: BUCKET,
        mimeType,
        fileExtension: ext.slice(1),
        url: publicUrl,
        phase,
        isHeroImage: isHero,
        sortOrder: i,
        projectId: project.id,
      })
    }

    console.log(`  Uploaded ${imageFiles.length} images`)
  }

  console.log(`  Done → /showroom/${project.accessor}`)

  return {
    folder: folderName,
    folderPath,
    status: 'imported',
    projectId: project.id,
    accessor: project.accessor,
    imageCount: imageFiles.length,
    scopeCount: scopeIds.length,
  }
}

async function main(): Promise<void> {
  const { mode, folderPaths } = await parseArgs()

  if (mode === 'all') {
    console.log(`\n=== Batch Import: ${folderPaths.length} projects ===`)

    const results: ImportResult[] = []

    for (let i = 0; i < folderPaths.length; i++) {
      console.log(`\n[${i + 1}/${folderPaths.length}] ${path.basename(folderPaths[i])}`)

      try {
        const result = await importProject(folderPaths[i])
        results.push(result)

        // Move to imported/ on success or duplicate skip
        if (result.status === 'imported' || result.status === 'skipped') {
          moveToImported(result.folderPath)
        }
      }
      catch (error) {
        const folderName = path.basename(folderPaths[i])
        const message = error instanceof Error ? error.message : String(error)
        console.error(`  Failed: ${message}`)
        results.push({ folder: folderName, folderPath: folderPaths[i], status: 'failed', reason: message })
      }
    }

    // Summary
    const imported = results.filter(r => r.status === 'imported')
    const skipped = results.filter(r => r.status === 'skipped')
    const failed = results.filter(r => r.status === 'failed')

    console.log('\n=== Import Summary ===')
    console.log(`  Imported: ${imported.length}`)
    console.log(`  Skipped:  ${skipped.length} (duplicates)`)
    console.log(`  Failed:   ${failed.length}`)

    if (imported.length > 0) {
      console.log('\nImported projects:')
      for (const r of imported) {
        console.log(`  ${r.folder} → /showroom/${r.accessor} (${r.imageCount} images, ${r.scopeCount} scopes)`)
      }
    }

    if (failed.length > 0) {
      console.log('\nFailed projects:')
      for (const r of failed) {
        console.log(`  ${r.folder}: ${r.reason}`)
      }
    }

    console.log('')
  }
  else {
    console.log('\n=== Project Importer ===')
    const result = await importProject(folderPaths[0])

    if (result.status === 'imported' || result.status === 'skipped') {
      moveToImported(result.folderPath)
    }

    console.log('')
  }

  process.exit(0)
}

main().catch((error) => {
  console.error('\nFatal error:', error.message || error)
  process.exit(1)
})
