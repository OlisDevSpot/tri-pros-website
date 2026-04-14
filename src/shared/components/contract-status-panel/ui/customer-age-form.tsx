'use client'

import { useMutation } from '@tanstack/react-query'
import { Loader2, ShieldCheck } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

interface CustomerAgeFormProps {
  proposalId: string
  token?: string
}

export function CustomerAgeForm({ proposalId, token }: CustomerAgeFormProps) {
  const [age, setAge] = useState('')
  const trpc = useTRPC()
  const { invalidateProposal } = useInvalidation()

  const submitAge = useMutation(
    trpc.proposalsRouter.contracts.submitCustomerAge.mutationOptions({
      onSuccess: () => {
        invalidateProposal()
        toast.success('Age saved')
      },
      onError: () => {
        toast.error('Failed to save age')
      },
    }),
  )

  const parsedAge = Number.parseInt(age, 10)
  const isValid = !Number.isNaN(parsedAge) && parsedAge >= 18 && parsedAge <= 120

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4"
    >
      <div className="flex items-start gap-2.5">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-medium text-foreground">Age verification required</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Per standard CA and CSLB home improvement contract requirements, any customers over the
            age of 65 must receive 5 days right of cancellation instead of the standard 3 days.
            Please specify your age below to continue with your agreement.
          </p>
        </div>
      </div>

      <div className="flex items-end gap-2">
        <div className="w-24">
          <label htmlFor="customer-age" className="mb-1 block text-xs font-medium text-muted-foreground">
            Age
          </label>
          <Input
            id="customer-age"
            type="number"
            min={18}
            max={120}
            placeholder="e.g. 42"
            value={age}
            onChange={e => setAge(e.target.value)}
            disabled={submitAge.isPending}
          />
        </div>
        <Button
          onClick={() => {
            if (isValid) {
              submitAge.mutate({ proposalId, token, age: parsedAge })
            }
          }}
          disabled={!isValid || submitAge.isPending}
          size="sm"
        >
          {submitAge.isPending
            ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              )
            : 'Confirm & Continue'}
        </Button>
      </div>
    </motion.div>
  )
}
