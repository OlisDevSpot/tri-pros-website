import { notFound, redirect } from 'next/navigation'
import { IntakeFormView } from '@/features/intake/ui/views/intake-form-view'
import { ROOTS } from '@/shared/config/roots'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { getRequestActor } from '@/shared/domains/permissions/server/get-request-actor'
import { getActiveLeadSourceByLink } from '@/shared/entities/lead-sources/dal/server/queries'
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
    const { actor } = await getRequestActor()

    if (actor.ability.can('manage', 'all')) {
      redirect(ROOTS.dashboard.leadSources())
    }

    redirect('/')
  }

  // One answer for an unknown slug, a wrong token and an archived source, so a guess learns nothing.
  const row = dalVerifySuccess(await getActiveLeadSourceByLink(source, token))
  if (!row) {
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
          token={token}
        />
      </div>
    </main>
  )
}
