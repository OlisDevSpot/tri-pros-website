import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { OUTPUT_BASE_DIR } from './constants'
import type { CliFlags, ImagePhase, PagesConfig, ProjectContentOutput } from './types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env from project root
config({ path: path.resolve(__dirname, '..', '..', '.env') })

function parsePagesArg(value: string): PagesConfig {
  // Formats:
  //   "page=1-5"       → param "page", pages [1,2,3,4,5]
  //   "page=1,3,5"     → param "page", pages [1,3,5]
  //   "p=2-4"          → param "p", pages [2,3,4]
  const eqIdx = value.indexOf('=')
  if (eqIdx === -1) {
    // Assume param is "page" and value is range/list
    return { param: 'page', pageNumbers: parsePageNumbers(value) }
  }

  const param = value.slice(0, eqIdx)
  const rest = value.slice(eqIdx + 1)
  return { param, pageNumbers: parsePageNumbers(rest) }
}

function parsePageNumbers(value: string): number[] {
  // Range: "1-5" → [1,2,3,4,5]
  const rangeMatch = value.match(/^(\d+)-(\d+)$/)
  if (rangeMatch) {
    const start = Number.parseInt(rangeMatch[1], 10)
    const end = Number.parseInt(rangeMatch[2], 10)
    const pages: number[] = []
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    return pages
  }

  // Comma-separated: "1,3,5" → [1,3,5]
  return value.split(',').map(s => Number.parseInt(s.trim(), 10)).filter(n => !Number.isNaN(n))
}

function parseArgs(): CliFlags {
  const args = process.argv.slice(2)

  const flags: CliFlags = {
    url: '',
    scopesDescription: '',
    classify: false,
    headful: false,
    verbose: false,
    pages: null,
    multiProject: null,
    source: null,
    limit: 0,
  }

  const positional: string[] = []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--classify') flags.classify = true
    else if (arg === '--headful') flags.headful = true
    else if (arg === '--verbose' || arg === '-v') flags.verbose = true
    else if (arg === '--help' || arg === '-h') {
      printUsage()
      process.exit(0)
    }
    else if (arg === '--source') {
      const next = args[++i]
      if (!next) {
        console.error('Error: --source requires a value (e.g. --source homeadvisor)\n')
        process.exit(1)
      }
      flags.source = next
    }
    else if (arg === '--limit') {
      const next = args[++i]
      const parsed = Number.parseInt(next, 10)
      if (!next || Number.isNaN(parsed) || parsed < 1) {
        console.error('Error: --limit requires a positive number (e.g. --limit 5)\n')
        process.exit(1)
      }
      flags.limit = parsed
    }
    else if (arg === '--pages') {
      const next = args[++i]
      if (!next) {
        console.error('Error: --pages requires a value (e.g. --pages "page=1-5")\n')
        process.exit(1)
      }
      flags.pages = parsePagesArg(next)
    }
    else if (arg === '--multi-project') {
      // Optional next arg is a CSS selector; default to 'auto'
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        flags.multiProject = next
        i++
      }
      else {
        flags.multiProject = 'auto'
      }
    }
    else {
      positional.push(arg)
    }
  }

  flags.url = positional[0] || ''
  flags.scopesDescription = positional[1] || ''

  if (!flags.url) {
    console.error('Error: URL is required\n')
    printUsage()
    process.exit(1)
  }

  // Scopes description is optional when:
  //   - --multi-project mode (prompted per group)
  //   - --source flag (prompted interactively)
  //   - Auto-detected site scraper (validated in main() after async import)
  // We skip validation here — main() handles the final check.

  if (flags.pages && flags.multiProject) {
    console.error('Error: --pages and --multi-project cannot be used together\n')
    process.exit(1)
  }

  return flags
}

function printUsage(): void {
  console.log(`
Portfolio Project Scraper — Tri Pros Remodeling

Usage:
  pnpm scrape-project <url> "<scopes description>" [flags]
  pnpm scrape-project <url> --source <name> [flags]
  pnpm scrape-project <url> --multi-project [selector] [flags]

Arguments:
  url                 URL to scrape project images from
  scopes description  Comma-separated trade/scope names (e.g., "kitchen remodel, flooring")
                      Optional with --multi-project and --source (prompted later)

Flags:
  --classify                Classify images by phase (before/during/after) using GPT-4o vision
  --headful                 Run browser in visible mode (for debugging)
  -v, --verbose             Log every URL found and every filter decision
  -h, --help                Show this help message

  --source <name>           Use a site-specific scraper (e.g. --source homeadvisor).
                            Handles site-specific UI interactions (carousels, dialogs, etc.)
                            Auto-detected from URL domain when not specified.

  --limit <n>               Max number of items to scrape from a site-specific source.
                            Useful for large pages (e.g. --limit 5 to grab first 5 projects).
                            Only applies to --source scrapers. Default: no limit.

  --pages <param=range>     Scrape a paginated project across multiple URLs.
                            Merges all images into a single project.
                            Format: "param=start-end" or "param=1,2,3"
                            Examples: --pages "page=1-5"  --pages "pg=1,2,3,4"
                            Shorthand (assumes ?page=): --pages "1-5"

  --multi-project [selector]  Scrape multiple projects from a SINGLE page.
                              Each group (section with heading + images) becomes
                              a separate project. Provide a CSS selector for the
                              group containers, or omit for auto-detection (looks
                              for h2/h3 headings with sibling/child images).
                              Examples: --multi-project
                                        --multi-project "div.project-card"
                                        --multi-project "section.gallery-group"

Registered site scrapers:
  - homeadvisor      Domains: homeadvisor.com
                     Scrapes carousel dialogs (click thumbnail -> extract dialog images)

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

  # Site-specific: HomeAdvisor carousel scraping (auto-detected or explicit)
  pnpm scrape-project "https://www.homeadvisor.com/rated.Company.12345.html" "kitchen"
  pnpm scrape-project "https://www.homeadvisor.com/rated.Company.12345.html" --source homeadvisor

  # Paginated: scrape pages 1-5 of a gallery
  pnpm scrape-project "https://example.com/gallery" "kitchen" --pages "page=1-5"

  # Multi-project: auto-detect project groups on one page
  pnpm scrape-project "https://example.com/all-projects" "bathroom, kitchen" --multi-project

  # Multi-project with custom selector
  pnpm scrape-project "https://example.com/portfolio" "roofing" --multi-project "div.project"
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

/**
 * Prompt for a free-text scope description and fuzzy-match against Notion scopes.
 * Used in multi-project mode where each group needs its own scope input.
 */
async function promptForScopes(
  allScopes: { id: string, name: string, entryType: string }[],
  fuzzyMatchScopes: (scopes: typeof allScopes, description: string) => import('./types').MatchedScope[],
  groupHeading: string,
): Promise<import('./types').MatchedScope[]> {
  const { input } = await import('@inquirer/prompts')

  const scopeInput = await input({
    message: `Scopes for "${groupHeading}" (comma-separated, e.g. "kitchen remodel, flooring"):`,
  })

  if (!scopeInput.trim()) {
    console.log('  No scopes entered — will be empty.')
    return []
  }

  const matched = fuzzyMatchScopes(allScopes, scopeInput)

  if (matched.length > 0) {
    console.log(`  Matched ${matched.length} scopes:`)
    for (const s of matched) {
      console.log(`    - ${s.name} (${s.entryType})`)
    }
  }
  else {
    console.log(`  No scopes matched for "${scopeInput}"`)
  }

  return matched
}

/**
 * Process a single project: prompts, download, classify, generate content, write files.
 * Extracted to share between standard and multi-project modes.
 */
async function processSingleProject(opts: {
  images: import('./types').ScrapedImage[]
  metadata: import('./types').PageMetadata
  matchedScopes: import('./types').MatchedScope[]
  classifyFlag: boolean
  headful: boolean
  label?: string
  /** Browser session cookies for authenticated downloads */
  cookies?: string
  /** Source URL (used as Referer for downloads) */
  sourceUrl?: string
  /** When set, prompts for scopes per group instead of using matchedScopes */
  perGroupScopes?: {
    allScopes: { id: string, name: string, entryType: string }[]
    fuzzyMatchScopes: (scopes: { id: string, name: string, entryType: string }[], description: string) => import('./types').MatchedScope[]
    groupHeading: string
  }
}): Promise<void> {
  const prefix = opts.label ? `[${opts.label}] ` : ''

  // Resolve scopes — either pre-matched or prompt per group
  let matchedScopes = opts.matchedScopes
  if (opts.perGroupScopes) {
    matchedScopes = await promptForScopes(
      opts.perGroupScopes.allScopes,
      opts.perGroupScopes.fuzzyMatchScopes,
      opts.perGroupScopes.groupHeading,
    )
  }

  // Interactive prompts
  console.log(`\n${prefix}Project configuration...`)
  const { runPrompts } = await import('./prompts')
  const answers = await runPrompts({
    imageCount: opts.images.length,
    pageTitle: opts.metadata.title,
    matchedScopes,
    classifyFlag: opts.classifyFlag,
  })

  if (!answers) {
    console.log(`${prefix}Skipped by user.`)
    return
  }

  // Download images
  const projectDir = path.join(OUTPUT_BASE_DIR, answers.accessor)
  const imageDir = path.join(projectDir, 'images')

  console.log(`\n${prefix}Downloading ${opts.images.length} images to ${imageDir}...`)
  const { downloadImages } = await import('./download-images')
  const downloadedFiles = await downloadImages(opts.images, imageDir, {
    cookies: opts.cookies,
    referer: opts.sourceUrl,
  })
  console.log(`  Successfully downloaded ${downloadedFiles.length} images`)

  if (downloadedFiles.length === 0) {
    console.error(`  ${prefix}ERROR: No images downloaded. Skipping.`)
    return
  }

  // Classify images (opt-in)
  let phaseMap: Record<string, ImagePhase> | null = null
  if (answers.classifyImages && downloadedFiles.length > 0) {
    console.log(`\n${prefix}Classifying images with AI vision...`)
    const { classifyImages } = await import('./classify-images')
    phaseMap = await classifyImages(downloadedFiles, imageDir)
    console.log('  Classification complete')
    writePhasesJson(projectDir, phaseMap)
    console.log('  Written phases.json')
  }

  // Generate AI content
  console.log(`\n${prefix}Generating storytelling content with AI...`)
  const { generateProjectContent } = await import('./generate-content')
  let content: ProjectContentOutput | null = null
  try {
    content = await generateProjectContent({
      scopes: answers.selectedScopes,
      metadata: opts.metadata,
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

  // Write output files
  console.log(`\n${prefix}Writing output files...`)
  const notionScopeIds = answers.selectedScopes.map(s => s.id)

  writeProjectMd(projectDir, answers, content, notionScopeIds)
  console.log('  Written project.md')

  writeProjectJson(projectDir, answers, content, notionScopeIds)
  console.log('  Written project.json')

  // Summary
  console.log(`\n${prefix}Done!`)
  console.log(`  Output: ${projectDir}`)
  console.log(`  Images: ${downloadedFiles.length}`)
  console.log(`  Scopes: ${answers.selectedScopes.map(s => s.name).join(', ') || 'none'}`)
  console.log(`  AI Content: ${content ? 'yes' : 'no'}`)
  console.log(`  Phase Classification: ${phaseMap ? 'yes' : 'no'}`)
}

async function main(): Promise<void> {
  const flags = parseArgs()
  validateEnv()

  const notionApiKey = process.env.NOTION_API_KEY!

  // ---- SITE-SPECIFIC SCRAPER DETECTION ----
  const { findScraperByName, findScraperByUrl } = await import('./site-scrapers/registry')

  let siteScraper = flags.source
    ? findScraperByName(flags.source)
    : findScraperByUrl(flags.url)

  if (flags.source && !siteScraper) {
    console.error(`Error: Unknown site scraper "${flags.source}"`)
    const { listScrapers } = await import('./site-scrapers/registry')
    const available = listScrapers()
    if (available.length > 0) {
      console.error(`Available scrapers: ${available.map(s => s.name).join(', ')}`)
    }
    process.exit(1)
  }

  // Deferred scope validation — if no site scraper, no multi-project, and no scopes, error
  if (!flags.scopesDescription && !flags.multiProject && !siteScraper) {
    console.error('Error: Scopes description is required\n')
    printUsage()
    process.exit(1)
  }

  const mode = siteScraper
    ? `site:${siteScraper.name}`
    : flags.multiProject
      ? 'multi-project'
      : flags.pages
        ? 'paginated'
        : 'standard'

  console.log(`\n=== Portfolio Project Scraper (${mode} mode) ===\n`)

  if (siteScraper && !flags.source) {
    console.log(`  Auto-detected site scraper: ${siteScraper.name}`)
  }

  // Step 1: Fetch scopes from Notion
  console.log('[1] Fetching scopes from Notion...')
  const { fetchAllScopes, fuzzyMatchScopes } = await import('./fetch-scopes')
  const allScopes = await fetchAllScopes(notionApiKey)
  console.log(`  Loaded ${allScopes.length} scopes from Notion`)

  // In multi-project mode or site scraper mode, scopes may be prompted later
  let matchedScopes: import('./types').MatchedScope[] = []
  if (flags.scopesDescription) {
    matchedScopes = fuzzyMatchScopes(allScopes, flags.scopesDescription)
    console.log(`  Matched ${matchedScopes.length} scopes for "${flags.scopesDescription}"`)
    for (const s of matchedScopes) {
      console.log(`    - ${s.name} (${s.entryType})`)
    }
  }

  // ---- SITE-SPECIFIC SCRAPER MODE ----
  if (siteScraper) {
    console.log(`\n[2] Running ${siteScraper.name} scraper...`)
    const result = await siteScraper.scrape({
      url: flags.url,
      headful: flags.headful,
      verbose: flags.verbose,
      limit: flags.limit,
    })

    // Check if the scraper returned multi-project results
    const isMulti = 'kind' in result && result.kind === 'multi'

    if (isMulti) {
      const { groups, metadata } = result

      if (groups.length === 0) {
        console.error('  ERROR: No projects found on the page.')
        process.exit(1)
      }

      console.log(`\n  Found ${groups.length} projects:`)
      for (let i = 0; i < groups.length; i++) {
        console.log(`    ${i + 1}. "${groups[i].heading}" — ${groups[i].images.length} images`)
      }

      // Process each project group (prompted for scopes per project)
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i]
        const label = `${i + 1}/${groups.length}: "${group.heading}"`

        console.log(`\n${'='.repeat(60)}`)
        console.log(`  Processing: ${group.heading}`)
        console.log(`${'='.repeat(60)}`)

        await processSingleProject({
          images: group.images,
          metadata: { ...metadata, title: group.heading },
          matchedScopes: [],
          classifyFlag: flags.classify,
          headful: flags.headful,
          label,
          sourceUrl: flags.url,
          perGroupScopes: {
            allScopes,
            fuzzyMatchScopes,
            groupHeading: group.heading,
          },
        })
      }

      console.log(`\n=== All ${groups.length} projects processed ===\n`)
    }
    else {
      // Single-project site scraper result
      const singleResult = result as import('./types').ScrapeResult

      if (matchedScopes.length === 0) {
        const { input } = await import('@inquirer/prompts')
        const scopeInput = await input({
          message: 'Scopes (comma-separated, e.g. "kitchen remodel, flooring"):',
        })
        if (scopeInput.trim()) {
          matchedScopes = fuzzyMatchScopes(allScopes, scopeInput)
          console.log(`  Matched ${matchedScopes.length} scopes`)
          for (const s of matchedScopes) {
            console.log(`    - ${s.name} (${s.entryType})`)
          }
        }
      }

      await processSingleProject({
        images: singleResult.images,
        metadata: singleResult.metadata,
        matchedScopes,
        classifyFlag: flags.classify,
        headful: flags.headful,
        cookies: singleResult.cookies,
        sourceUrl: flags.url,
      })
    }

    console.log('')
    process.exit(0)
  }

  // ---- MULTI-PROJECT MODE ----
  if (flags.multiProject) {
    console.log('\n[2] Scraping multi-project page...')
    const { scrapeMultiProjectPage } = await import('./scrape-images')
    const multiResult = await scrapeMultiProjectPage(
      flags.url,
      flags.multiProject,
      flags.headful,
      flags.verbose,
    )

    if (multiResult.groups.length === 0) {
      console.error('  ERROR: No project groups found on the page.')
      console.error('  Try providing a CSS selector: --multi-project "div.project-card"')
      process.exit(1)
    }

    console.log(`\n  Found ${multiResult.groups.length} project groups:`)
    for (let i = 0; i < multiResult.groups.length; i++) {
      console.log(`    ${i + 1}. "${multiResult.groups[i].heading}" — ${multiResult.groups[i].images.length} images`)
    }

    // Process each group as a separate project, prompting for scopes per group
    for (let i = 0; i < multiResult.groups.length; i++) {
      const group = multiResult.groups[i]
      const label = `${i + 1}/${multiResult.groups.length}: "${group.heading}"`

      console.log(`\n${'='.repeat(60)}`)
      console.log(`  Processing group: ${group.heading}`)
      console.log(`${'='.repeat(60)}`)

      await processSingleProject({
        images: group.images,
        metadata: { ...multiResult.metadata, title: group.heading },
        matchedScopes: [],
        classifyFlag: flags.classify,
        headful: flags.headful,
        label,
        cookies: multiResult.cookies,
        sourceUrl: flags.url,
        perGroupScopes: {
          allScopes,
          fuzzyMatchScopes,
          groupHeading: group.heading,
        },
      })
    }

    console.log(`\n=== All ${multiResult.groups.length} groups processed ===\n`)
    process.exit(0)
  }

  // ---- PAGINATED MODE ----
  if (flags.pages) {
    console.log(`\n[2] Scraping ${flags.pages.pageNumbers.length} pages (${flags.pages.param}=${flags.pages.pageNumbers.join(',')})...`)
    const { scrapePaginatedImages } = await import('./scrape-images')
    const paginatedResult = await scrapePaginatedImages(
      flags.url,
      flags.pages,
      flags.headful,
      flags.verbose,
    )

    await processSingleProject({
      images: paginatedResult.images,
      metadata: paginatedResult.metadata,
      matchedScopes,
      classifyFlag: flags.classify,
      headful: flags.headful,
      sourceUrl: flags.url,
    })

    console.log('')
    process.exit(0)
  }

  // ---- STANDARD MODE (single URL, single project) ----
  console.log('\n[2] Scraping images from URL...')
  const { scrapeImages } = await import('./scrape-images')
  const scrapeResult = await scrapeImages(flags.url, flags.headful, flags.verbose)

  await processSingleProject({
    images: scrapeResult.images,
    metadata: scrapeResult.metadata,
    matchedScopes,
    classifyFlag: flags.classify,
    headful: flags.headful,
    cookies: scrapeResult.cookies,
    sourceUrl: flags.url,
  })

  console.log('')
  process.exit(0)
}

main().catch((error) => {
  console.error('\nFatal error:', error.message || error)
  process.exit(1)
})
