import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { IntakeFormView } from '@/features/intake/ui/views/intake-form-view'
import { ROOTS } from '@/shared/config/roots'
import { db } from '@/shared/db'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'
import { auth } from '@/shared/domains/auth/server'
import { leadSourceFormConfigSchema } from '@/shared/entities/lead-sources/schemas'

interface Props {
  searchParams: Promise<{ source?: string, token?: string }>
}

export default async function PublicIntakePage({ searchParams }: Props) {
  const { source, token } = await searchParams

  // Bare /intake — route super-admins to the Lead Sources admin page,
  // everyone else to the home page. External URLs always include both
  // `source` and `token`, so this branch only fires on accidental hits.
  if (!source || !token) {
    const reqHeaders = await headers()
    const session = await auth.api.getSession({ headers: reqHeaders })

    if (session?.user.role === 'super-admin') {
      redirect(ROOTS.dashboard.leadSources())
    }

    redirect('/')
  }

  // Fetch lead source by slug, then verify token matches. 404 on any mismatch
  // so attackers can't distinguish "slug doesn't exist" from "wrong token".
  const [row] = await db
    .select()
    .from(leadSourcesTable)
    .where(eq(leadSourcesTable.slug, source))
    .limit(1)

  if (!row || !row.isActive || row.token !== token) {
    notFound()
  }

  const formConfig = leadSourceFormConfigSchema.parse(row.formConfigJSON)

  return (
    <main className="flex h-screen flex-col bg-background px-4 pb-4">
      {/* Pinned header */}
      <div className="shrink-0 pt-6 pb-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight">New Lead</h1>
        <p className="mt-2 text-muted-foreground">{row.name}</p>
      </div>

      {/* Card fills remaining height; IntakeFormView handles internal scroll */}
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col min-h-0 rounded-xl border border-border bg-card p-6 shadow-sm">
        <IntakeFormView
          mode={formConfig.mode}
          formConfig={formConfig}
          leadSourceSlug={row.slug}
        />
      </div>
    </main>
  )
}
