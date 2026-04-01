import type { MatchedScope, ProjectPromptAnswers } from './types'
import { checkbox, confirm } from '@inquirer/prompts'
import { generateHomeownerName, pickCity, pickProjectTitle } from './constants'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

export async function runPrompts(opts: {
  imageCount: number
  pageTitle?: string
  matchedScopes: MatchedScope[]
  classifyFlag: boolean
}): Promise<ProjectPromptAnswers | null> {
  // Image count check
  if (opts.imageCount < 7) {
    console.log(`\n  WARNING: Only ${opts.imageCount} images found (minimum recommended: 7)`)
    const proceed = await confirm({
      message: `Continue with only ${opts.imageCount} images?`,
      default: false,
    })
    if (!proceed) {
      console.log('  Aborted by user.')
      return null
    }
  }
  else {
    console.log(`\n  Found ${opts.imageCount} images`)
  }

  // Auto-generate project title (artsy single word)
  const title = pickProjectTitle()
  const accessor = slugify(title)
  console.log(`  Title: ${title}`)
  console.log(`  Slug: ${accessor}`)

  // Auto-pick a SoCal city
  const city = pickCity()
  console.log(`  City: ${city}, CA`)

  // Auto-generate homeowner name
  const homeownerName = generateHomeownerName()
  console.log(`  Homeowner: ${homeownerName}`)

  // Scope selection — only interactive prompt remaining
  let selectedScopes: MatchedScope[] = opts.matchedScopes
  if (opts.matchedScopes.length > 0) {
    const scopeChoices = opts.matchedScopes.map(s => ({
      name: `${s.name} (${s.entryType})`,
      value: s.id,
      checked: true,
    }))

    const selectedIds = await checkbox({
      message: 'Confirm scopes (matched from Notion):',
      choices: scopeChoices,
    })

    selectedScopes = opts.matchedScopes.filter(s => selectedIds.includes(s.id))
  }
  else {
    console.log('  No scopes matched from Notion — scopeIds will be empty.')
  }

  // Classification (only if --classify flag was passed)
  let classifyImages = false
  if (opts.classifyFlag) {
    classifyImages = await confirm({
      message: 'Classify images by phase (before/during/after) with AI vision?',
      default: true,
    })
  }

  return {
    title,
    accessor,
    city,
    state: 'CA',
    homeownerName,
    projectDuration: null,
    selectedScopes,
    generateAi: true, // Always generate AI content
    classifyImages,
  }
}
