import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { OUTPUT_BASE_DIR } from './constants'
import type { CliFlags, ImagePhase, ProjectContentOutput } from './types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env from project root
config({ path: path.resolve(__dirname, '..', '..', '.env') })

function parseArgs(): CliFlags {
  const args = process.argv.slice(2)

  const flags: CliFlags = {
    url: '',
    scopesDescription: '',
    classify: false,
    headful: false,
    verbose: false,
  }

  const positional: string[] = []

  for (const arg of args) {
    if (arg === '--classify') flags.classify = true
    else if (arg === '--headful') flags.headful = true
    else if (arg === '--verbose' || arg === '-v') flags.verbose = true
    else if (arg === '--help' || arg === '-h') {
      printUsage()
      process.exit(0)
    }
    else positional.push(arg)
  }

  flags.url = positional[0] || ''
  flags.scopesDescription = positional[1] || ''

  if (!flags.url) {
    console.error('Error: URL is required\n')
    printUsage()
    process.exit(1)
  }

  if (!flags.scopesDescription) {
    console.error('Error: Scopes description is required\n')
    printUsage()
    process.exit(1)
  }

  return flags
}

function printUsage(): void {
  console.log(`
Portfolio Project Scraper — Tri Pros Remodeling

Usage:
  pnpm scrape-project <url> "<scopes description>" [flags]

Arguments:
  url                 URL to scrape project images from
  scopes description  Comma-separated trade/scope names (e.g., "kitchen remodel, flooring")

Flags:
  --classify    Classify images by phase (before/during/after) using GPT-4o vision
  --headful     Run browser in visible mode (for debugging)
  -v, --verbose Log every URL found and every filter decision
  -h, --help    Show this help message

Auto-generated fields:
  Title         Unique artsy single-word name (tracked to avoid repeats)
  City          Random SoCal city within 40 miles of Studio City
  State         Always CA
  Homeowner     Random diverse full name
  AI Content    Always generated (storytelling copy via GPT-4.1-mini)

Examples:
  pnpm scrape-project "https://contractor-site.com/gallery" "roofing, HVAC"
  pnpm scrape-project "https://photos.example.com/album" "kitchen remodel" --classify
  pnpm scrape-project "https://example.com/project" "bathroom remodel" --verbose
`)
}

function validateEnv(): void {
  const notionKey = process.env.NOTION_API_KEY
  if (!notionKey) {
    console.error('Error: NOTION_API_KEY not found in .env')
    process.exit(1)
  }

  if (!process.env.OPENAI_API_KEY) {
    console.warn('Warning: OPENAI_API_KEY not found in .env — AI features will fail')
  }
}

function writeProjectMd(
  outputDir: string,
  answers: import('./types').ProjectPromptAnswers,
  content: ProjectContentOutput | null,
  notionScopeIds: string[],
): void {
  const frontmatter = [
    '---',
    `title: "${answers.title}"`,
    `accessor: "${answers.accessor}"`,
    `description: "${content?.description?.replace(/"/g, '\\"') || ''}"`,
    `isPublic: true`,
    `city: "${answers.city}"`,
    `state: "${answers.state}"`,
    ...(answers.homeownerName ? [`homeownerName: "${answers.homeownerName}"`] : []),
    ...(answers.projectDuration ? [`projectDuration: "${answers.projectDuration}"`] : []),
    `notionScopeIds: [${notionScopeIds.map(id => `"${id}"`).join(', ')}]`,
    `scopeNames: [${answers.selectedScopes.map(s => `"${s.name}"`).join(', ')}]`,
    '---',
  ].join('\n')

  const sections = [
    frontmatter,
    '',
    `# ${answers.title}`,
    '',
  ]

  if (content) {
    sections.push(
      '## Backstory',
      content.backstory,
      '',
      '## Challenge',
      content.challengeDescription,
      '',
      '## Solution',
      content.solutionDescription,
      '',
      '## Result',
      content.resultDescription,
      '',
      '## Homeowner Quote',
      `> "${content.homeownerQuote}"`,
      '',
    )
  }
  else {
    sections.push(
      '## Backstory',
      '<!-- TODO: Add backstory -->',
      '',
      '## Challenge',
      '<!-- TODO: Add challenge description -->',
      '',
      '## Solution',
      '<!-- TODO: Add solution description -->',
      '',
      '## Result',
      '<!-- TODO: Add result description -->',
      '',
      '## Homeowner Quote',
      '> "<!-- TODO: Add homeowner quote -->"',
      '',
    )
  }

  fs.writeFileSync(path.join(outputDir, 'project.md'), sections.join('\n'))
}

function writeProjectJson(
  outputDir: string,
  answers: import('./types').ProjectPromptAnswers,
  content: ProjectContentOutput | null,
  notionScopeIds: string[],
): void {
  const projectData = {
    title: answers.title,
    accessor: answers.accessor,
    description: content?.description || null,
    backstory: content?.backstory || null,
    isPublic: true,
    address: null,
    city: answers.city,
    state: answers.state,
    zip: null,
    hoRequirements: null,
    homeownerName: answers.homeownerName,
    homeownerQuote: content?.homeownerQuote || null,
    projectDuration: answers.projectDuration,
    completedAt: null,
    challengeDescription: content?.challengeDescription || null,
    solutionDescription: content?.solutionDescription || null,
    resultDescription: content?.resultDescription || null,
    scopeIds: [], // Requires Postgres ID mapping during import
    notionScopeIds,
    scopeNames: answers.selectedScopes.map(s => s.name),
  }

  fs.writeFileSync(
    path.join(outputDir, 'project.json'),
    JSON.stringify(projectData, null, 2),
  )
}

function writePhasesJson(
  outputDir: string,
  phaseMap: Record<string, ImagePhase>,
): void {
  fs.writeFileSync(
    path.join(outputDir, 'phases.json'),
    JSON.stringify(phaseMap, null, 2),
  )
}

async function main(): Promise<void> {
  const flags = parseArgs()
  validateEnv()

  const notionApiKey = process.env.NOTION_API_KEY!

  console.log('\n=== Portfolio Project Scraper ===\n')

  // Step 1: Fetch scopes from Notion
  console.log('[1/7] Fetching scopes from Notion...')
  const { fetchAllScopes, fuzzyMatchScopes } = await import('./fetch-scopes')
  const allScopes = await fetchAllScopes(notionApiKey)
  console.log(`  Loaded ${allScopes.length} scopes from Notion`)

  const matchedScopes = fuzzyMatchScopes(allScopes, flags.scopesDescription)
  console.log(`  Matched ${matchedScopes.length} scopes for "${flags.scopesDescription}"`)
  for (const s of matchedScopes) {
    console.log(`    - ${s.name} (${s.entryType})`)
  }

  // Step 2: Scrape images
  console.log('\n[2/7] Scraping images from URL...')
  const { scrapeImages } = await import('./scrape-images')
  const { images, metadata } = await scrapeImages(flags.url, flags.headful, flags.verbose)

  // Step 3: Interactive prompts
  console.log('\n[3/7] Project configuration...')
  const { runPrompts } = await import('./prompts')
  const answers = await runPrompts({
    imageCount: images.length,
    pageTitle: metadata.title,
    matchedScopes,
    classifyFlag: flags.classify,
  })

  if (!answers) {
    process.exit(0)
  }

  // Step 4: Download images
  const projectDir = path.join(OUTPUT_BASE_DIR, answers.accessor)
  const imageDir = path.join(projectDir, 'images')

  console.log(`\n[4/7] Downloading ${images.length} images to ${imageDir}...`)
  const { downloadImages } = await import('./download-images')
  const downloadedFiles = await downloadImages(images, imageDir)
  console.log(`  Successfully downloaded ${downloadedFiles.length} images`)

  if (downloadedFiles.length === 0) {
    console.error('  ERROR: No images downloaded. Aborting.')
    process.exit(1)
  }

  // Step 5: Classify images (opt-in)
  let phaseMap: Record<string, ImagePhase> | null = null
  if (answers.classifyImages && downloadedFiles.length > 0) {
    console.log('\n[5/7] Classifying images with AI vision...')
    const { classifyImages } = await import('./classify-images')
    phaseMap = await classifyImages(downloadedFiles, imageDir)
    console.log('  Classification complete')
    writePhasesJson(projectDir, phaseMap)
    console.log('  Written phases.json')
  }
  else {
    console.log('\n[5/7] Skipping image classification')
  }

  // Step 6: Generate AI content (always runs)
  console.log('\n[6/7] Generating storytelling content with AI...')
  const { generateProjectContent } = await import('./generate-content')
  let content: ProjectContentOutput | null = null
  try {
    content = await generateProjectContent({
      scopes: answers.selectedScopes,
      metadata,
      title: answers.title,
      city: answers.city,
    })
    console.log('  Content generated successfully')
  }
  catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`  ERROR generating AI content: ${msg}`)
    console.log('  Continuing without AI content...')
  }

  // Step 7: Write output files
  console.log('\n[7/7] Writing output files...')
  const notionScopeIds = answers.selectedScopes.map(s => s.id)

  writeProjectMd(projectDir, answers, content, notionScopeIds)
  console.log('  Written project.md')

  writeProjectJson(projectDir, answers, content, notionScopeIds)
  console.log('  Written project.json')

  // Summary
  console.log('\n=== Done! ===')
  console.log(`  Output: ${projectDir}`)
  console.log(`  Images: ${downloadedFiles.length}`)
  console.log(`  Scopes: ${answers.selectedScopes.map(s => s.name).join(', ') || 'none'}`)
  console.log(`  AI Content: ${content ? 'yes' : 'no'}`)
  console.log(`  Phase Classification: ${phaseMap ? 'yes' : 'no'}`)
  console.log('')
}

main().catch((error) => {
  console.error('\nFatal error:', error.message || error)
  process.exit(1)
})
