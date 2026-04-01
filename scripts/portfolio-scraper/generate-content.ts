import type { MatchedScope, PageMetadata, ProjectContentOutput } from './types'
import { openai } from '@ai-sdk/openai'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { STORYTELLING_SYSTEM_PROMPT } from './constants'

const contentOutputSchema = z.object({
  description: z.string().max(255),
  backstory: z.string(),
  challengeDescription: z.string(),
  solutionDescription: z.string(),
  resultDescription: z.string(),
  homeownerQuote: z.string(),
})

interface GenerateContentInput {
  scopes: MatchedScope[]
  metadata: PageMetadata
  title: string
  city: string
}

export async function generateProjectContent(
  input: GenerateContentInput,
): Promise<ProjectContentOutput> {
  const scopeNames = input.scopes.map(s => s.name).join(', ')

  const prompt = `
Generate portfolio content for this Tri Pros Remodeling project:

**Project Title**: ${input.title}
**Location**: ${input.city}, CA
**Scopes/Trades**: ${scopeNames}

**Page Context** (scraped from source):
- Page Title: ${input.metadata.title || 'N/A'}
- Page Description: ${input.metadata.description || 'N/A'}
- Page Content Excerpt: ${input.metadata.bodyText?.slice(0, 1000) || 'N/A'}

Generate the 6 fields (description, backstory, challengeDescription, solutionDescription, resultDescription, homeownerQuote) following the system prompt rules exactly.
  `.trim()

  const { output } = await generateText({
    model: openai('gpt-4.1-mini-2025-04-14'),
    system: STORYTELLING_SYSTEM_PROMPT,
    prompt,
    output: Output.object({
      schema: contentOutputSchema,
    }),
  })

  if (!output) {
    throw new Error('Failed to generate project content — no output returned')
  }

  return output
}
