import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { openai } from '@ai-sdk/openai'
import { generateText, Output } from 'ai'
import { eq } from 'drizzle-orm'
import z from 'zod'
import { db } from '@/shared/db'
import { proposals } from '@/shared/db/schema'

export async function generateProjectSummary(proposalId: string, proposal: Partial<ProposalFormSchema>) {
  try {
    const { output } = await generateText({
      model: openai('gpt-4.1-mini-2025-04-14'),
      system:
      `
      RULES — PROJECT SUMMARY
      - Always generate a professional 3–4 sentence summary.
      - Focus on homeowner benefits, lifestyle improvement, comfort, durability, aesthetics, and property value.
      - Sell the future outcome, not the construction process.
      - Never mention the tcp or any dollar amounts.
      - Avoid technical jargon unless it directly improves perceived value.
      - Tone should feel confident, premium, and trustworthy.

      RULES — ENERGY BENEFITS FIELD
      - Only populate this field if the project scope reasonably creates measurable long-term savings or efficiency improvements.
      - Otherwise return an empty string "".
      - When included, describe:
        - Utility savings (electricity, gas, water)
        - Maintenance reduction
        - Longevity / durability savings
        - Efficiency improvements
        - Comfort improvements tied to efficiency
      - Do NOT exaggerate or fabricate savings.
      - Keep this section 1–2 sentences maximum.

      EXAMPLES OF PROJECTS THAT MAY HAVE ENERGY BENEFITS
      - Roofing (cool roof, insulation improvements)
      - Windows / doors
      - HVAC
      - Plumbing upgrades
      - Landscaping conversions (turf removal, drip irrigation)
      - Exterior envelope improvements
      - Solar-adjacent prep

      EXAMPLES WITHOUT ENERGY BENEFITS
      - Interior paint
      - Cosmetic finishes only
      - Decorative upgrades with no efficiency impact

      TERMINOLOGY
      tcp = total contract price (never mention in output)

      GOAL
      Maximize homeowner excitement, perceived value, and emotional confidence in moving forward.
      
      `,
      prompt: `Generate a project summary with the given paramters:
        ${JSON.stringify(proposal, null, 2)}
      `,
      output: Output.object({
        schema: z.object({
          projectSummary: z.string(),
          energyBenefits: z.string().optional(),
        }),
      }),
    })

    await db
      .update(proposals)
      .set(output)
      .where(eq(proposals.id, proposalId))
  }
  catch {
    throw new Error('Failed to generate project summary')
  }
}
