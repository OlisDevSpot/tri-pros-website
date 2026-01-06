import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/shared/auth/lib/utils'
import { ROOTS } from '@/shared/config/roots'

export default async function AdminPage() {
  await requireAuth(await getHeaders(), () => {
    redirect(`${ROOTS.generateUrl('/', { absolute: true })}`)
  })

  return (
    <>
      <h1>Protected Admin Page</h1>
    </>
  )
}
