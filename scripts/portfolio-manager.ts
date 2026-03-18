/**
 * Portfolio Manager — Interactive terminal UI
 *
 * Orchestrates scrape-project and import-project scripts with a
 * menu-driven interface. Run with: pnpm portfolio
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { checkbox, confirm, input, select } from '@inquirer/prompts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')
const ASSETS_DIR = path.resolve(PROJECT_ROOT, '..', '_assets', 'portfolio-projects')

// ─── CLI Parsing ────────────────────────────────────────────────────

interface CliArgs {
  command: 'interactive' | 'scrape' | 'import' | 'view' | 'help'
  /** import-specific: import all projects at once */
  all: boolean
  /** import-specific: folder name(s) to import */
  folders: string[]
  /** scrape-specific: URL to scrape */
  url: string
  /** scrape-specific: scopes description */
  scopes: string
  /** scrape-specific flags passed through to scrape-project */
  scrapeFlags: string[]
}

function printHelp(): void {
  console.log(`
Portfolio Manager — Tri Pros Remodeling
Interactive terminal UI for scraping & importing portfolio projects.

Usage:
  pnpm portfolio                          Interactive menu (default)
  pnpm portfolio scrape <url> "<scopes>" [flags]
  pnpm portfolio import [folder...] [--all]
  pnpm portfolio view
  pnpm portfolio -h | --help

Commands:
  (none)        Launch interactive menu
  scrape        Scrape a project from a URL (delegates to pnpm scrape-project)
  import        Import scraped project(s) to R2 + Postgres
  view          List all scraped projects and their status

Import flags:
  --all         Import every project that has a project.json (skips duplicates)
  [folder...]   One or more folder names from _assets/portfolio-projects/

Scrape flags (passed through to scrape-project):
  --classify    Classify images by phase (before/during/after) using AI vision
  --headful     Run browser in visible mode
  -v, --verbose Log every URL found and every filter decision
  --source <n>  Use a site-specific scraper (e.g. --source homeadvisor)
                Auto-detected from URL domain when not specified.
  --pages <cfg> Scrape paginated project (e.g. --pages "page=1-5")
  --multi-project [selector]
                Scrape multiple projects from a single page

Registered site scrapers:
  homeadvisor   Carousel dialog scraping (click thumbnail -> extract images)

General:
  -h, --help    Show this help message

Duplicate handling:
  When importing, projects whose accessor already exists in Postgres are
  automatically SKIPPED (not upserted). Safe to run --all repeatedly.

Examples:
  pnpm portfolio                                    # interactive menu
  pnpm portfolio scrape "https://example.com/gallery" "kitchen remodel"
  pnpm portfolio scrape "https://example.com/gallery" "roofing" --classify --verbose
  pnpm portfolio import aureate                     # import one project
  pnpm portfolio import aureate meridian solstice   # import multiple
  pnpm portfolio import --all                       # import all, skip duplicates
  pnpm portfolio view                               # list scraped projects
`)
}

function parseCliArgs(): CliArgs {
  const rawArgs = process.argv.slice(2)

  const result: CliArgs = {
    command: 'interactive',
    all: false,
    folders: [],
    url: '',
    scopes: '',
    scrapeFlags: [],
  }

  if (rawArgs.length === 0) return result

  // Check for top-level help
  if (rawArgs[0] === '-h' || rawArgs[0] === '--help') {
    result.command = 'help'
    return result
  }

  const command = rawArgs[0]

  if (command === 'scrape') {
    result.command = 'scrape'
    // Everything after "scrape" is passed through to scrape-project
    const rest = rawArgs.slice(1)
    if (rest.includes('-h') || rest.includes('--help')) {
      result.command = 'help'
      return result
    }
    // Extract positional args (url, scopes) and flags
    const positional: string[] = []
    for (let i = 0; i < rest.length; i++) {
      const arg = rest[i]
      if (arg.startsWith('-')) {
        // Flag — include it and its value if applicable
        result.scrapeFlags.push(arg)
        if ((arg === '--pages' || arg === '--multi-project' || arg === '--source' || arg === '--limit') && rest[i + 1] && !rest[i + 1].startsWith('-')) {
          result.scrapeFlags.push(rest[++i])
        }
      }
      else {
        positional.push(arg)
      }
    }
    result.url = positional[0] || ''
    result.scopes = positional[1] || ''
    return result
  }

  if (command === 'import') {
    result.command = 'import'
    const rest = rawArgs.slice(1)
    if (rest.includes('-h') || rest.includes('--help')) {
      result.command = 'help'
      return result
    }
    for (const arg of rest) {
      if (arg === '--all') {
        result.all = true
      }
      else if (!arg.startsWith('-')) {
        result.folders.push(arg)
      }
    }
    return result
  }

  if (command === 'view') {
    result.command = 'view'
    return result
  }

  // Unknown command — treat as help
  result.command = 'help'
  return result
}

// ─── Helpers ────────────────────────────────────────────────────────

function runScript(command: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      shell: true,
    })

    child.on('close', (code) => resolve(code ?? 1))
    child.on('error', reject)
  })
}

function getScrapedProjects(): { name: string, hasJson: boolean, imageCount: number }[] {
  if (!fs.existsSync(ASSETS_DIR)) return []

  return fs.readdirSync(ASSETS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'imported')
    .map((d) => {
      const dir = path.join(ASSETS_DIR, d.name)
      const hasJson = fs.existsSync(path.join(dir, 'project.json'))
      const imagesDir = path.join(dir, 'images')
      const imageCount = fs.existsSync(imagesDir)
        ? fs.readdirSync(imagesDir).filter((f) => /\.(?:jpg|jpeg|png|webp)$/i.test(f)).length
        : 0
      return { name: d.name, hasJson, imageCount }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

function printBanner(): void {
  console.log('')
  console.log('╔══════════════════════════════════════════════╗')
  console.log('║     Tri Pros — Portfolio Manager             ║')
  console.log('║     Scrape → Classify → Import → Done        ║')
  console.log('╚══════════════════════════════════════════════╝')
  console.log('')
}

function printProjectTable(projects: ReturnType<typeof getScrapedProjects>): void {
  if (projects.length === 0) {
    console.log('  No scraped projects found.\n')
    return
  }

  console.log('  ┌────────────────────────┬────────────┬────────┐')
  console.log('  │ Project                │ Images     │ Status │')
  console.log('  ├────────────────────────┼────────────┼────────┤')
  for (const p of projects) {
    const name = p.name.padEnd(22).slice(0, 22)
    const imgs = String(p.imageCount).padStart(5)
    const status = p.hasJson ? '  ✓   ' : '  ✗   '
    console.log(`  │ ${name} │ ${imgs}      │${status}│`)
  }
  console.log('  └────────────────────────┴────────────┴────────┘')
  console.log('')
}

// ─── Actions ────────────────────────────────────────────────────────

async function actionScrape(): Promise<string | null> {
  console.log('\n── Scrape New Project ──\n')

  const url = await input({ message: 'URL to scrape:' })
  if (!url.trim()) {
    console.log('No URL provided. Returning to menu.\n')
    return null
  }

  const scopes = await input({
    message: 'Scopes (comma-separated, e.g. "kitchen remodel, flooring"):',
  })

  const flags: string[] = []

  const classify = await confirm({
    message: 'Classify images by phase (before/during/after) with AI?',
    default: false,
  })
  if (classify) flags.push('--classify')

  const headful = await confirm({
    message: 'Run browser in visible mode (headful)?',
    default: false,
  })
  if (headful) flags.push('--headful')

  const verbose = await confirm({
    message: 'Verbose logging?',
    default: false,
  })
  if (verbose) flags.push('--verbose')

  const mode = await select({
    message: 'Scraping mode:',
    choices: [
      { name: 'Standard (single URL → single project)', value: 'standard' },
      { name: 'Site-specific (HomeAdvisor, etc. — handles carousels/dialogs)', value: 'site' },
      { name: 'Paginated (multiple pages → single project)', value: 'paginated' },
      { name: 'Multi-project (single page → multiple projects)', value: 'multi' },
    ],
  })

  if (mode === 'site') {
    const source = await select({
      message: 'Select source:',
      choices: [
        { name: 'HomeAdvisor (carousel + dialog scraping)', value: 'homeadvisor' },
        { name: 'Auto-detect from URL', value: '' },
      ],
    })
    if (source) {
      flags.push('--source', source)
    }
  }

  if (mode === 'paginated') {
    const pages = await input({
      message: 'Pages config (e.g. "page=1-5" or "1-5"):',
    })
    if (pages.trim()) flags.push('--pages', pages.trim())
  }

  if (mode === 'multi') {
    const selector = await input({
      message: 'CSS selector for groups (leave empty for auto-detect):',
    })
    if (selector.trim()) {
      flags.push('--multi-project', selector.trim())
    }
    else {
      flags.push('--multi-project')
    }
  }

  const args = ['scrape-project', url.trim()]
  if (scopes.trim() && mode !== 'multi') {
    args.push(scopes.trim())
  }
  args.push(...flags)

  console.log(`\nRunning: pnpm ${args.join(' ')}\n`)

  const code = await runScript('pnpm', args)

  if (code !== 0) {
    console.log(`\nScrape exited with code ${code}.\n`)
    return null
  }

  // Try to find the newest folder (created just now)
  const after = getScrapedProjects()
  if (after.length > 0) {
    // Return the most recently modified folder
    const withMtime = after.map((p) => ({
      ...p,
      mtime: fs.statSync(path.join(ASSETS_DIR, p.name)).mtimeMs,
    }))
    withMtime.sort((a, b) => b.mtime - a.mtime)
    return withMtime[0].name
  }

  return null
}

async function actionSiteScrape(): Promise<string | null> {
  console.log('\n── Scrape from Known Source ──\n')

  const source = await select({
    message: 'Select source:',
    choices: [
      { name: 'HomeAdvisor (carousel + dialog scraping)', value: 'homeadvisor' },
    ],
  })

  const url = await input({ message: 'URL to scrape:' })
  if (!url.trim()) {
    console.log('No URL provided. Returning to menu.\n')
    return null
  }

  const limitStr = await input({
    message: 'Max projects to scrape (leave empty for all):',
  })

  const scopes = await input({
    message: 'Scopes (comma-separated, e.g. "kitchen remodel, flooring") — leave empty to be prompted per project:',
  })

  const flags: string[] = ['--source', source]

  const limitNum = Number.parseInt(limitStr.trim(), 10)
  if (!Number.isNaN(limitNum) && limitNum > 0) {
    flags.push('--limit', String(limitNum))
  }

  const classify = await confirm({
    message: 'Classify images by phase (before/during/after) with AI?',
    default: false,
  })
  if (classify) flags.push('--classify')

  const headful = await confirm({
    message: 'Run browser in visible mode (headful)?',
    default: false,
  })
  if (headful) flags.push('--headful')

  const verbose = await confirm({
    message: 'Verbose logging?',
    default: false,
  })
  if (verbose) flags.push('--verbose')

  const args = ['scrape-project', url.trim()]
  if (scopes.trim()) {
    args.push(scopes.trim())
  }
  args.push(...flags)

  console.log(`\nRunning: pnpm ${args.join(' ')}\n`)

  const code = await runScript('pnpm', args)

  if (code !== 0) {
    console.log(`\nScrape exited with code ${code}.\n`)
    return null
  }

  // Try to find the newest folder (created just now)
  const after = getScrapedProjects()
  if (after.length > 0) {
    const withMtime = after.map((p) => ({
      ...p,
      mtime: fs.statSync(path.join(ASSETS_DIR, p.name)).mtimeMs,
    }))
    withMtime.sort((a, b) => b.mtime - a.mtime)
    return withMtime[0].name
  }

  return null
}

async function actionImport(): Promise<void> {
  console.log('\n── Import Project to R2 + Postgres ──\n')

  const projects = getScrapedProjects().filter((p) => p.hasJson)

  if (projects.length === 0) {
    console.log('No importable projects found. Scrape one first.\n')
    return
  }

  printProjectTable(projects)

  const importMode = await select({
    message: 'What to import?',
    choices: [
      { name: 'Select specific projects', value: 'pick' },
      { name: 'Import ALL projects', value: 'all' },
    ],
  })

  if (importMode === 'all') {
    const ok = await confirm({
      message: `Import all ${projects.length} projects?`,
      default: true,
    })
    if (!ok) return

    console.log(`\nRunning: pnpm import-project --all\n`)
    await runScript('pnpm', ['import-project', '--all'])
  }
  else {
    const selected = await checkbox({
      message: 'Select projects to import:',
      choices: projects.map((p) => ({
        name: `${p.name} (${p.imageCount} images)`,
        value: p.name,
      })),
    })

    if (selected.length === 0) {
      console.log('Nothing selected.\n')
      return
    }

    for (const name of selected) {
      console.log(`\nImporting: ${name}`)
      console.log(`Running: pnpm import-project ${name}\n`)
      const code = await runScript('pnpm', ['import-project', name])
      if (code !== 0) {
        console.log(`  Import of "${name}" failed (code ${code}).`)
        const cont = await confirm({ message: 'Continue with remaining?', default: true })
        if (!cont) break
      }
    }
  }

  console.log('\nImport complete.\n')
}

async function actionScrapeAndImport(): Promise<void> {
  console.log('\n── Scrape + Import Pipeline ──\n')
  console.log('Step 1: Scrape project from URL')

  const folderName = await actionScrape()

  if (!folderName) {
    console.log('Scrape did not produce a project. Skipping import.\n')
    return
  }

  console.log(`\nScrape complete: ${folderName}`)

  const proceed = await confirm({
    message: `Import "${folderName}" to R2 + Postgres now?`,
    default: true,
  })

  if (!proceed) {
    console.log('Skipping import. You can import later from the menu.\n')
    return
  }

  console.log(`\nStep 2: Importing ${folderName}...`)
  console.log(`Running: pnpm import-project ${folderName}\n`)

  await runScript('pnpm', ['import-project', folderName])
  console.log('\nPipeline complete.\n')
}

function getImportedCount(): number {
  const importedDir = path.join(ASSETS_DIR, 'imported')
  if (!fs.existsSync(importedDir)) return 0
  return fs.readdirSync(importedDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .length
}

async function actionViewProjects(): Promise<void> {
  console.log('\n── Scraped Projects ──\n')
  const projects = getScrapedProjects()
  printProjectTable(projects)

  const importable = projects.filter((p) => p.hasJson).length
  const total = projects.length
  const imported = getImportedCount()
  console.log(`  ${total} pending, ${importable} ready to import, ${imported} already imported\n`)
}

// ─── CLI-driven actions (non-interactive) ───────────────────────────

async function cliScrape(args: CliArgs): Promise<void> {
  const scriptArgs = ['scrape-project']

  if (args.url) scriptArgs.push(args.url)
  if (args.scopes) scriptArgs.push(args.scopes)
  scriptArgs.push(...args.scrapeFlags)

  console.log(`\nRunning: pnpm ${scriptArgs.join(' ')}\n`)
  const code = await runScript('pnpm', scriptArgs)
  process.exit(code)
}

async function cliImport(args: CliArgs): Promise<void> {
  if (args.all) {
    console.log('\nImporting all projects (duplicates will be skipped)...\n')
    const code = await runScript('pnpm', ['import-project', '--all'])
    process.exit(code)
  }

  if (args.folders.length > 0) {
    for (const folder of args.folders) {
      console.log(`\nImporting: ${folder}`)
      const code = await runScript('pnpm', ['import-project', folder])
      if (code !== 0) {
        console.error(`Import of "${folder}" failed (code ${code}).`)
        process.exit(code)
      }
    }
    console.log('\nAll imports complete.\n')
    process.exit(0)
  }

  // No folders specified — fall through to interactive import
  printBanner()
  await actionImport()
  process.exit(0)
}

function cliView(): void {
  console.log('\n── Scraped Projects ──\n')
  const projects = getScrapedProjects()
  printProjectTable(projects)

  const importable = projects.filter((p) => p.hasJson).length
  const total = projects.length
  console.log(`  ${total} total, ${importable} ready to import\n`)
  process.exit(0)
}

// ─── Main ───────────────────────────────────────────────────────────

async function interactiveMenu(): Promise<void> {
  printBanner()

  let running = true

  while (running) {
    const action = await select({
      message: 'What would you like to do?',
      choices: [
        { name: '🔗  Scrape + Import (full pipeline)', value: 'pipeline' },
        { name: '🌐  Scrape project from URL', value: 'scrape' },
        { name: '🏠  Scrape from known source (HomeAdvisor, etc.)', value: 'site-scrape' },
        { name: '📦  Import scraped project(s) to R2 + DB', value: 'import' },
        { name: '📋  View scraped projects', value: 'view' },
        { name: '👋  Exit', value: 'exit' },
      ],
    })

    switch (action) {
      case 'pipeline':
        await actionScrapeAndImport()
        break
      case 'scrape':
        await actionScrape()
        break
      case 'site-scrape':
        await actionSiteScrape()
        break
      case 'import':
        await actionImport()
        break
      case 'view':
        await actionViewProjects()
        break
      case 'exit':
        running = false
        console.log('Bye!\n')
        break
    }
  }

  process.exit(0)
}

async function main(): Promise<void> {
  const args = parseCliArgs()

  switch (args.command) {
    case 'help':
      printHelp()
      process.exit(0)
      break
    case 'scrape':
      await cliScrape(args)
      break
    case 'import':
      await cliImport(args)
      break
    case 'view':
      cliView()
      break
    case 'interactive':
      await interactiveMenu()
      break
  }
}

main().catch((error) => {
  console.error('\nFatal error:', error.message || error)
  process.exit(1)
})
