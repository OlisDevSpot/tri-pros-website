/* eslint-disable no-console */
'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { TopSpacer } from '@/shared/components/top-spacer'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { ViewportHero } from '@/shared/components/viewport-hero'
import { useTRPC } from '@/trpc/helpers'

export default function TestPage() {
  const [inputValue, setInputValue] = useState('')
  const [isEnabled, setIsEnabled] = useState(false)

  const trpc = useTRPC()
  const runTest = useQuery(trpc.notionRouter.scopes.getScopesByTrade.queryOptions({ tradeId: 'a9c0ca1b548b835b93128152b409d577' }, { enabled: isEnabled }))

  if (runTest.data) {
    console.log(runTest.data)
  }

  return (
    <ViewportHero>
      <TopSpacer>
        <Input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
        />
        <Button
          onClick={() => {
            setIsEnabled(true)
            runTest.refetch().finally(() => setIsEnabled(false))
          }}
        >
          Run Notion Test
        </Button>
        <pre></pre>
      </TopSpacer>
    </ViewportHero>
  )
}
