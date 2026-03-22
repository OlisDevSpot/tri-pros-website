import type { LeadSource } from '@/shared/types/enums'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { IntakeFormView } from '@/features/intake/ui/views/intake-form-view'
import { db } from '@/shared/db'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'
import { leadSourceFormConfigSchema } from '@/shared/entities/lead-sources/schemas'

interface Props {
  params: Promise<{ token: string }>
}

export default async function IntakePage({ params }: Props) {
  const { token } = await params

  const [row] = await db
    .select()
    .from(leadSourcesTable)
    .where(eq(leadSourcesTable.token, token))
    .limit(1)

  if (!row || !row.isActive) {
    notFound()
  }

  const formConfig = leadSourceFormConfigSchema.parse(row.formConfigJSON)

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <IntakeFormView
        leadSourceSlug={row.slug as LeadSource}
        leadSourceName={row.name}
        formConfig={formConfig}
      />
    </main>
  )
}
