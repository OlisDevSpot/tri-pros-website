'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { TopSpacer } from '@/shared/components/top-spacer'
import { Button } from '@/shared/components/ui/button'
import { ViewportHero } from '@/shared/components/viewport-hero'
import { useTRPC } from '@/trpc/helpers'

export default function TestPage() {
  const trpc = useTRPC()
  const test = useQuery(trpc.docusignRouter.getAccessToken.queryOptions())
  const sendEnvelope = useMutation(trpc.docusignRouter.sendEnvelope.mutationOptions())

  return (
    <ViewportHero>
      <TopSpacer>
        <pre>{JSON.stringify(test.data, null, 2)}</pre>
        <Button
          onClick={() => {
            sendEnvelope.mutate({
              templateId: '6a8da4cb-db4d-44b7-a956-82bc4f0590e9',
            }, {
              onSuccess: (data) => {
                toast.success(`Envelope sent!. ${JSON.stringify(data, null, 2)}`)
              },
            })
          }}
        >
          Send Envelope
        </Button>
      </TopSpacer>
    </ViewportHero>
  )
}
