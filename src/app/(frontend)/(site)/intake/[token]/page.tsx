import type { LeadSource } from '@/shared/types/enums'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { IntakeFormView } from '@/features/intake/ui/views/intake-form-view'
import { TopSpacer } from '@/shared/components/top-spacer'
import { ViewportHero } from '@/shared/components/viewport-hero'
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
    <ViewportHero className="bg-background">
      <TopSpacer>
        <div className="mx-auto flex h-full w-full max-w-lg flex-col items-center justify-center gap-8 px-4 py-10">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">New Lead</h1>
            <p className="mt-2 text-muted-foreground">{row.name}</p>
          </div>
          <div className="w-full rounded-xl border border-border bg-card p-6 shadow-sm">
            <IntakeFormView
              leadSourceSlug={row.slug as LeadSource}
              formConfig={formConfig}
            />
          </div>
        </div>
      </TopSpacer>
    </ViewportHero>
  )
}
