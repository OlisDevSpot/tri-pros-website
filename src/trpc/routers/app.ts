import type { PageObjectResponse } from '@notionhq/client'
import z from 'zod'
import { proposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { generateProjectSummary } from '@/shared/services/ai/generate-project-summary'
import { queryContactsDatabase } from '@/shared/services/notion/dal/query-contacts'
import { baseProcedure, createTRPCRouter } from '../init'
import { constructionRouter } from './construction.router'
import { docusignRouter } from './docusign.router'
import { hubspotRouter } from './hubspot.router'
import { landingRouter } from './landing.router'
import { notionRouter } from './notion.router'
import { proposalRouter } from './proposal.router'

export const appRouter = createTRPCRouter({
  test: baseProcedure
    .input(proposalFormSchema)
    .query(async ({ ctx, input }) => {
      await generateProjectSummary({
        ...input,
      })

      return { resHeaders: [...ctx.resHeaders.entries()] }
    }),
  testNotion: baseProcedure
    .input(
      z.object({ name: z.string() }),
    )
    .query(async ({ input }) => {
      const response = await queryContactsDatabase(input.name)

      return response.results as PageObjectResponse[]
    }),
  healthcheck: baseProcedure.query(() => 'ok'),
  landingRouter,
  notionRouter,
  hubspotRouter,
  docusignRouter,
  constructionRouter,
  proposalRouter,
})

export type AppRouter = typeof appRouter
