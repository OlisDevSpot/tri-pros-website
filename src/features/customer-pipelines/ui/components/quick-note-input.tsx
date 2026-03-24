'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { useTRPC } from '@/trpc/helpers'

interface Props {
  customerId: string
  onSuccess: () => void
}

export function QuickNoteInput({ customerId, onSuccess }: Props) {
  const [content, setContent] = useState('')
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const addNoteMutation = useMutation(
    trpc.customersRouter.addNote.mutationOptions({
      onSuccess: () => {
        setContent('')
        void queryClient.invalidateQueries(trpc.customerPipelinesRouter.getCustomerProfile.queryFilter())
        onSuccess()
      },
    }),
  )

  function handleSubmit() {
    const trimmed = content.trim()
    if (!trimmed) {
      return
    }
    addNoteMutation.mutate({ customerId, content: trimmed })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit()
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        className="min-h-[64px] resize-none text-sm"
        disabled={addNoteMutation.isPending}
        onChange={e => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a note..."
        rows={2}
        value={content}
      />
      <div className="flex justify-end">
        <Button
          disabled={addNoteMutation.isPending || !content.trim()}
          onClick={handleSubmit}
          size="sm"
          variant="outline"
        >
          {addNoteMutation.isPending ? 'Adding...' : 'Add'}
        </Button>
      </div>
    </div>
  )
}
