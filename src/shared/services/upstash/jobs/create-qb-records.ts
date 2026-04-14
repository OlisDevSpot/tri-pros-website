import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { projects } from '@/shared/db/schema/projects'
import { accountingService } from '@/shared/services/accounting.service'
import { createJob } from '../lib/create-job'

export const createQbRecordsJob = createJob(
  'create-qb-records',
  async ({ projectId }: { projectId: string }) => {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))

    if (!project?.customerId) {
      console.error(`[qstash:create-qb-records] Project ${projectId} has no customer`)
      return
    }

    const qbCustomerId = await accountingService.ensureCustomer(project.customerId)
    await accountingService.ensureProjectSubCustomer(projectId, qbCustomerId)
  },
)
