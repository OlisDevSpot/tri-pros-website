'use client'

import { useQuery } from '@tanstack/react-query'
import { TopSpacer } from '@/shared/components/top-spacer'
import { Button } from '@/shared/components/ui/button'
import { ViewportHero } from '@/shared/components/viewport-hero'
import { useTRPC } from '@/trpc/helpers'

export default function TestPage() {
  const trpc = useTRPC()
  const test = useQuery(trpc.test.queryOptions({
    homeowner: {
      customerAge: 64,
      firstName: 'Leticia',
      lastName: 'Loredo',
      email: 'leticialoredo22@gmail.com',
      phoneNum: '1234567890',
    },
    project: {
      address: '9684 Bartee Ave',
      city: 'Arleta',
      state: 'CA',
      zipCode: '91331',
      projectType: 'general-remodeling',
      label: 'Leticia Loredo Main',
      scopes: [
        {
          trade: 'atticBasement',
          scope: ['rnrAtticInsulation'],
          sow: 'Remove and reinstall existing attic insulation with R38 batts insulation',
        },
      ],
      timeAllocated: '6 months',
      agreementNotes: 'test',
    },
    funding: {
      tcp: 230000,
      depositAmount: 1000,
      cashInDeal: 0,
    },
  }))

  return (
    <ViewportHero>
      <TopSpacer>
        <pre>{JSON.stringify(test.data, null, 2)}</pre>
        <Button>
          Send Envelope
        </Button>
      </TopSpacer>
    </ViewportHero>
  )
}
