import type { ProposalFormValues } from '@/features/proposal-flow/schemas/form-schema'
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'

export async function generateProjectSummary(proposal: ProposalFormValues) {
  try {
    const { text } = await generateText({
      model: openai('gpt-4.1-mini-2025-04-14'),
      system:
      `
      You are a project summary generator. 
      You are a professional copywriter and have tremendous experience in construction & construction sales.
      You will be given project details like customer name, scopes of work interested, exact address, cost of project etc, and you will generate a short summary of the project.
      Your only job is to output a 4 sentence "marketing" project summary that will be presented to a potential customer via a dynamic proposal
      
      IMPORTANT TERMINOLOGIES:
      - tcp = total contact price

      EXPECTED OUTPUT:
      - do not generate text that highlights the absolute investment amount (tcp). Instead, focus on future home energy savings like gas, water, electricity (if any), and property value increase
      - your goal is to "sell" to the homeowner a future with the upgrades installed - how amazing it would be, and how much his property and his lifestyle would benefit
      `,
      prompt: `Generate a project summary with the given paramters:
        ${JSON.stringify(proposal, null, 2)}
      `,
    })

    // eslint-disable-next-line no-console
    console.log(text)
  }
  catch {
    throw new Error('Failed to generate project summary')
  }
}
