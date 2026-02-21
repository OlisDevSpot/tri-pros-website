import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { openai } from '@ai-sdk/openai'
import { generateText, Output } from 'ai'
import { eq } from 'drizzle-orm'
import z from 'zod'
import { db } from '@/shared/db'
import { proposals } from '@/shared/db/schema'

export async function generateProjectSummary(proposalId: string, proposal: ProposalFormSchema) {
  try {
    const { output } = await generateText({
      model: openai('gpt-4.1-mini-2025-04-14'),
      system:
      `
      You are a project summary generator. 
      You are a professional copywriter and have tremendous experience in construction & construction sales.
      You will be given project details like customer name, scopes of work interested, exact address, cost of project etc, and you will generate a short summary of the project.
      Your only job is to output a 4 sentence "marketing" project summary that will be presented to a potential customer via a dynamic proposal. You must analyze the complete information and output both a complete summary of the project's beneficial outcomes for the customer as well as energy benefits (if they exist) by doing this project. 
      
      IMPORTANT TERMINOLOGIES:
      - tcp = total contact price

      EXPECTED OUTPUT:
      - do not generate text that highlights the absolute investment amount (tcp). Instead, focus on future home energy savings like gas, water, electricity (if any), and property value increase
      - your goal is to "sell" to the homeowner a future with the upgrades installed - how amazing it would be, and how much his property and his lifestyle would benefit
      - ONLY OUTPUT RESPONSE FOR energy savings parameter if we can infer some utility/maintennace savings from undergoing this scope of work. Otherwise, return an empty string

      EXAMPLE ENERGY BENEFITS:
      - utility savings by lowering heating & cooling costs (cool roof, new efficient HVAC, double-pane windows, etc)
      - water conservation (dry landscaping, hardscaping, plumbing upgrades etc)
      - gardening & mainentence savings (paying for landscaping, regular maintenance, broken sprinklers etc)
      
      `,
      prompt: `Generate a project summary with the given paramters:
        ${JSON.stringify(proposal, null, 2)}
      `,
      output: Output.object({
        schema: z.object({
          projectSummary: z.string(),
          energyBenefits: z.string(),
        }),
      }),
    })

    await db
      .update(proposals)
      .set({
        projectSummary: output.projectSummary,
        energyBenefits: output.energyBenefits,
      })
      .where(eq(proposals.id, proposalId))
  }
  catch {
    throw new Error('Failed to generate project summary')
  }
}
