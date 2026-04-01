import { eq } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { IntakeFormView } from '@/features/intake/ui/views/intake-form-view'
import { auth } from '@/shared/auth/server'
import { db } from '@/shared/db'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'
import { leadSourceFormConfigSchema } from '@/shared/entities/lead-sources/schemas'

interface Props {
  searchParams: Promise<{ source?: string }>
}

export default async function PublicIntakePage({ searchParams }: Props) {
  const { source } = await searchParams

  // No source param — check auth and redirect accordingly
  if (!source) {
    const reqHeaders = await headers()
    const session = await auth.api.getSession({ headers: reqHeaders })

    if (session?.user.role === 'super-admin') {
      redirect('/dashboard/intake')
    }

    redirect('/')
  }

  // Fetch lead source by slug
  const [row] = await db
    .select()
    .from(leadSourcesTable)
    .where(eq(leadSourcesTable.slug, source))
    .limit(1)

  if (!row || !row.isActive) {
    notFound()
  }

  const formConfig = leadSourceFormConfigSchema.parse(row.formConfigJSON)

  return (
    <main className="flex min-h-screen items-start justify-center bg-background pt-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-8 px-4 py-10">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">New Lead</h1>
          <p className="mt-2 text-muted-foreground">{row.name}</p>
        </div>
        <div className="w-full rounded-xl border border-border bg-card p-6 shadow-sm">
          <IntakeFormView
            mode={formConfig.mode}
            formConfig={formConfig}
            leadSourceSlug={row.slug}
          />
        </div>
      </div>
    </main>
  )
}
