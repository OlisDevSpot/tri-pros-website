# Contract Status Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable `ContractStatusPanel` component that shows contract signing status and provides agent actions (send, resend, recall), replacing the existing `agreement-link` and `send-proposal-link` sections in the proposal page.

**Architecture:** Zoho Sign types defined in the SDK layer. `contractService.getSigningStatus` upgraded to return typed per-signer statuses. Three new tRPC procedures (`getContractStatus`, `recallContract`, `resendContract`). A shared component with agent/homeowner views, polling hook, and cooldown hook.

**Tech Stack:** React, tRPC (TanStack Query), shadcn/ui (AlertDialog, Button, Tooltip), lucide-react icons, Zoho Sign REST API

**Spec:** `docs/superpowers/specs/2026-04-08-contract-status-panel-design.md`

---

## Task 1: Zoho Sign Types

**Files:**
- Create: `src/shared/services/zoho-sign/types.ts`

- [ ] **Step 1: Create Zoho Sign type definitions**

```ts
// src/shared/services/zoho-sign/types.ts

export const zohoRequestStatuses = [
  'draft', 'inprogress', 'completed', 'declined', 'recalled', 'expired',
] as const
export type ZohoRequestStatus = (typeof zohoRequestStatuses)[number]

export const zohoActionStatuses = [
  'NOACTION', 'UNOPENED', 'VIEWED', 'SIGNED',
] as const
export type ZohoActionStatus = (typeof zohoActionStatuses)[number]

export interface ZohoSignerStatus {
  role: string
  status: ZohoActionStatus
  recipientEmail: string
}

export interface ZohoContractStatus {
  requestId: string
  requestStatus: ZohoRequestStatus
  signerStatuses: ZohoSignerStatus[]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/services/zoho-sign/types.ts
git commit -m "feat(zoho-sign): add typed Zoho Sign status enums and interfaces"
```

---

## Task 2: Update contractService.getSigningStatus

**Files:**
- Modify: `src/shared/services/contract.service.ts`

The current `getSigningStatus` returns `{ status: string }`. Update it to return the full `ZohoContractStatus` with per-signer statuses.

- [ ] **Step 1: Add import and update getSigningStatus**

Add import at top of `src/shared/services/contract.service.ts`:

```ts
import type { ZohoActionStatus, ZohoContractStatus, ZohoRequestStatus } from '@/shared/services/zoho-sign/types'
```

Replace the `getSigningStatus` method with:

```ts
    getSigningStatus: async (requestId: string): Promise<ZohoContractStatus> => {
      const res = await jsonRequest(`/requests/${requestId}`, { method: 'GET' })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Zoho Sign status check failed for ${requestId}: ${errorText}`)
      }

      const data = await res.json() as {
        requests: {
          request_id: string
          request_status: string
          actions: {
            role: string
            action_status: string
            recipient_email: string
          }[]
        }
      }

      const req = data.requests

      return {
        requestId: req.request_id,
        requestStatus: req.request_status as ZohoRequestStatus,
        signerStatuses: req.actions.map(a => ({
          role: a.role,
          status: a.action_status as ZohoActionStatus,
          recipientEmail: a.recipient_email,
        })),
      }
    },
```

- [ ] **Step 2: Verify compilation**

Run: `pnpm tsc --noEmit 2>&1 | grep -v "quickbooks\|webhooks" | grep "error"`

Expected: 0 results.

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/contract.service.ts
git commit -m "feat(contracts): getSigningStatus returns typed ZohoContractStatus with per-signer statuses"
```

---

## Task 3: New tRPC Procedures

**Files:**
- Modify: `src/trpc/routers/proposals.router/contracts.router.ts`

Add `getContractStatus`, `recallContract`, and `resendContract` procedures.

- [ ] **Step 1: Rewrite contracts.router.ts**

```ts
// src/trpc/routers/proposals.router/contracts.router.ts
import { TRPCError } from '@trpc/server'
import z from 'zod'
import { getProposal } from '@/shared/dal/server/proposals/api'
import { defineAbilitiesFor } from '@/shared/permissions/abilities'
import { contractService } from '@/shared/services/contract.service'
import { agentProcedure, baseProcedure, createTRPCRouter } from '../../init'

export const contractsRouter = createTRPCRouter({
  getContractStatus: baseProcedure
    .input(z.object({ proposalId: z.string(), token: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      const proposal = await getProposal(input.proposalId)

      if (!proposal) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
      }

      // Dual-gate: CASL ability OR valid share token
      const ability = defineAbilitiesFor(
        ctx.session ? { id: ctx.session.user.id, role: ctx.session.user.role } : null,
      )
      const canRead = ability.can('read', 'Proposal')
      const hasValidToken = input.token && proposal.token === input.token

      if (!canRead && !hasValidToken) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Access denied' })
      }

      if (!proposal.signingRequestId) {
        return null
      }

      try {
        const status = await contractService.getSigningStatus(proposal.signingRequestId)
        return {
          ...status,
          contractSentAt: proposal.contractSentAt,
        }
      }
      catch {
        // If Zoho Sign returns an error (e.g., request was deleted), return null
        return null
      }
    }),

  createContractDraft: agentProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const isOmni = ctx.ability.can('manage', 'all')
      const ownerKey = isOmni ? null : ctx.session.user.id
      return contractService.createSigningRequest(input.proposalId, ownerKey)
    }),

  submitContract: agentProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const isOmni = ctx.ability.can('manage', 'all')
      const ownerKey = isOmni ? null : ctx.session.user.id
      return contractService.sendSigningRequest(input.proposalId, ownerKey)
    }),

  sendContractForSigning: baseProcedure
    .input(z.object({ proposalId: z.string(), token: z.string() }))
    .mutation(async ({ input }) => {
      const proposal = await getProposal(input.proposalId)

      if (!proposal || proposal.token !== input.token) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid token' })
      }

      return contractService.sendSigningRequest(input.proposalId, input.token)
    }),

  recallContract: agentProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const isOmni = ctx.ability.can('manage', 'all')
      const ownerKey = isOmni ? null : ctx.session.user.id
      return contractService.recallSigningRequest(input.proposalId, ownerKey)
    }),

  resendContract: agentProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const isOmni = ctx.ability.can('manage', 'all')
      const ownerKey = isOmni ? null : ctx.session.user.id
      return contractService.resendSigningRequest(input.proposalId, ownerKey)
    }),
})
```

- [ ] **Step 2: Verify compilation**

Run: `pnpm tsc --noEmit 2>&1 | grep -v "quickbooks\|webhooks" | grep "error"`

- [ ] **Step 3: Commit**

```bash
git add src/trpc/routers/proposals.router/contracts.router.ts
git commit -m "feat(contracts): add getContractStatus, recallContract, resendContract procedures"
```

---

## Task 4: Contract Status Constants

**Files:**
- Create: `src/shared/components/contract-status-panel/constants/contract-statuses.ts`

- [ ] **Step 1: Create status configuration map**

```ts
// src/shared/components/contract-status-panel/constants/contract-statuses.ts
import type { ZohoActionStatus, ZohoRequestStatus } from '@/shared/services/zoho-sign/types'

interface RequestStatusConfig {
  label: string
  color: string
  dotClass: string
}

interface ActionStatusConfig {
  label: string
  icon: string
}

export const REQUEST_STATUS_CONFIG: Record<ZohoRequestStatus, RequestStatusConfig> = {
  draft: { label: 'Draft', color: 'text-muted-foreground', dotClass: 'bg-muted-foreground' },
  inprogress: { label: 'Awaiting Signatures', color: 'text-yellow-600', dotClass: 'bg-yellow-500' },
  completed: { label: 'Signed', color: 'text-green-600', dotClass: 'bg-green-500' },
  declined: { label: 'Declined', color: 'text-red-600', dotClass: 'bg-red-500' },
  recalled: { label: 'Recalled', color: 'text-muted-foreground', dotClass: 'bg-muted-foreground' },
  expired: { label: 'Expired', color: 'text-red-600', dotClass: 'bg-red-500' },
}

export const ACTION_STATUS_CONFIG: Record<ZohoActionStatus, ActionStatusConfig> = {
  NOACTION: { label: 'Waiting', icon: 'minus' },
  UNOPENED: { label: 'Unopened', icon: 'mail' },
  VIEWED: { label: 'Viewed', icon: 'eye' },
  SIGNED: { label: 'Signed', icon: 'check-circle' },
}

export const ACTION_TOOLTIPS = {
  sendForSigning: 'Submits the draft agreement to both parties for signing. This will consume 5 Zoho Sign credits.',
  resend: 'Cancels the current agreement and creates a new one with the latest proposal data. Costs 5 credits.',
  recall: 'Cancels the current agreement. Recipients will no longer be able to view or sign it.',
} as const
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/components/contract-status-panel/constants/contract-statuses.ts
git commit -m "feat(contract-panel): add status config constants with labels, colors, tooltips"
```

---

## Task 5: Hooks — useContractStatus + useCreditCooldown

**Files:**
- Create: `src/shared/components/contract-status-panel/hooks/use-contract-status.ts`
- Create: `src/shared/components/contract-status-panel/hooks/use-credit-cooldown.ts`
- Create: `src/shared/components/contract-status-panel/types.ts`

- [ ] **Step 1: Create types**

```ts
// src/shared/components/contract-status-panel/types.ts

export interface ContractStatusPanelProps {
  proposalId: string
  token?: string
  variant: 'full' | 'compact'
  isAgent: boolean
}
```

- [ ] **Step 2: Create useContractStatus hook**

```ts
// src/shared/components/contract-status-panel/hooks/use-contract-status.ts
import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/helpers'

export function useContractStatus(proposalId: string, token?: string) {
  const trpc = useTRPC()

  const query = useQuery({
    ...trpc.proposalsRouter.contracts.getContractStatus.queryOptions({ proposalId, token }),
    refetchInterval: (query) => {
      const status = query.state.data?.requestStatus
      if (status === 'inprogress') {
        return 30_000
      }
      return false
    },
  })

  return query
}
```

- [ ] **Step 3: Create useCreditCooldown hook**

```ts
// src/shared/components/contract-status-panel/hooks/use-credit-cooldown.ts
import { useCallback, useEffect, useRef, useState } from 'react'

const COOLDOWN_MS = 30_000

export function useCreditCooldown() {
  const [remainingMs, setRemainingMs] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startCooldown = useCallback(() => {
    setRemainingMs(COOLDOWN_MS)

    if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    timerRef.current = setInterval(() => {
      setRemainingMs((prev) => {
        if (prev <= 1000) {
          if (timerRef.current) {
            clearInterval(timerRef.current)
          }
          return 0
        }
        return prev - 1000
      })
    }, 1000)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  return {
    isCoolingDown: remainingMs > 0,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    startCooldown,
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/components/contract-status-panel/types.ts src/shared/components/contract-status-panel/hooks/
git commit -m "feat(contract-panel): add useContractStatus polling hook + useCreditCooldown timer"
```

---

## Task 6: SignerStatusRow Component

**Files:**
- Create: `src/shared/components/contract-status-panel/ui/signer-status-row.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/shared/components/contract-status-panel/ui/signer-status-row.tsx
import { CheckCircle, Eye, Mail, Minus } from 'lucide-react'
import type { ZohoActionStatus } from '@/shared/services/zoho-sign/types'
import { ACTION_STATUS_CONFIG } from '../constants/contract-statuses'

const ICONS: Record<ZohoActionStatus, React.ReactNode> = {
  NOACTION: <Minus className="size-4 text-muted-foreground" />,
  UNOPENED: <Mail className="size-4 text-muted-foreground" />,
  VIEWED: <Eye className="size-4 text-blue-500" />,
  SIGNED: <CheckCircle className="size-4 text-green-500" />,
}

interface SignerStatusRowProps {
  role: string
  status: ZohoActionStatus
}

export function SignerStatusRow({ role, status }: SignerStatusRowProps) {
  const config = ACTION_STATUS_CONFIG[status]

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{role}</span>
      <div className="flex items-center gap-1.5">
        {ICONS[status]}
        <span>{config.label}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/components/contract-status-panel/ui/signer-status-row.tsx
git commit -m "feat(contract-panel): add SignerStatusRow component"
```

---

## Task 7: AgentContractView Component

**Files:**
- Create: `src/shared/components/contract-status-panel/ui/agent-contract-view.tsx`

This is the core agent UI. It handles all 5 states, action buttons with tooltips, confirmation dialog for resend, and credit cooldown.

- [ ] **Step 1: Create the component**

```tsx
// src/shared/components/contract-status-panel/ui/agent-contract-view.tsx
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { useState } from 'react'
import type { ZohoContractStatus } from '@/shared/services/zoho-sign/types'
import { HybridPopoverTooltip } from '@/shared/components/hybridPopoverTooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog'
import { Button } from '@/shared/components/ui/button'
import { formatDate } from '@/shared/lib/formatters'
import { useTRPC } from '@/trpc/helpers'
import { ACTION_TOOLTIPS, REQUEST_STATUS_CONFIG } from '../constants/contract-statuses'
import { useCreditCooldown } from '../hooks/use-credit-cooldown'
import { SignerStatusRow } from './signer-status-row'

interface AgentContractViewProps {
  proposalId: string
  contractStatus: (ZohoContractStatus & { contractSentAt: string | null }) | null
}

function ActionButton(props: {
  label: string
  tooltip: string
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'outline' | 'destructive'
  cooldownSeconds?: number
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant={props.variant ?? 'outline'}
        onClick={props.onClick}
        disabled={props.disabled}
      >
        {props.cooldownSeconds
          ? `Wait ${props.cooldownSeconds}s...`
          : props.label}
      </Button>
      <HybridPopoverTooltip content={props.tooltip} side="top">
        <Info className="size-3.5 cursor-help text-muted-foreground" />
      </HybridPopoverTooltip>
    </div>
  )
}

export function AgentContractView({ proposalId, contractStatus }: AgentContractViewProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [showResendConfirm, setShowResendConfirm] = useState(false)
  const { isCoolingDown, remainingSeconds, startCooldown } = useCreditCooldown()

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.proposalsRouter.contracts.getContractStatus.queryKey({ proposalId }),
    })
  }

  const submitContract = useMutation(
    trpc.proposalsRouter.contracts.submitContract.mutationOptions({
      onSuccess: () => {
        startCooldown()
        invalidate()
      },
    }),
  )

  const recallContract = useMutation(
    trpc.proposalsRouter.contracts.recallContract.mutationOptions({
      onSuccess: () => {
        invalidate()
      },
    }),
  )

  const resendContract = useMutation(
    trpc.proposalsRouter.contracts.resendContract.mutationOptions({
      onSuccess: () => {
        startCooldown()
        invalidate()
      },
    }),
  )

  const isPending = submitContract.isPending || recallContract.isPending || resendContract.isPending
  const requestStatus = contractStatus?.requestStatus
  const statusConfig = requestStatus ? REQUEST_STATUS_CONFIG[requestStatus] : null

  // State 1: No contract
  if (!contractStatus) {
    return null
  }

  // State 5: Declined / Recalled / Expired
  if (requestStatus === 'declined' || requestStatus === 'recalled' || requestStatus === 'expired') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Contract: {statusConfig?.label}</span>
          <span className={`size-2.5 rounded-full ${statusConfig?.dotClass}`} />
        </div>
        <ActionButton
          label="Resend"
          tooltip={ACTION_TOOLTIPS.resend}
          onClick={() => setShowResendConfirm(true)}
          disabled={isPending || isCoolingDown}
          cooldownSeconds={isCoolingDown ? remainingSeconds : undefined}
        />
        <ResendConfirmDialog
          open={showResendConfirm}
          onOpenChange={setShowResendConfirm}
          onConfirm={() => {
            setShowResendConfirm(false)
            resendContract.mutate({ proposalId })
          }}
        />
      </div>
    )
  }

  // State 4: Completed
  if (requestStatus === 'completed') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Contract: {statusConfig?.label}</span>
          <span className={`size-2.5 rounded-full ${statusConfig?.dotClass}`} />
        </div>
        {contractStatus.signerStatuses.map(s => (
          <SignerStatusRow key={s.role} role={s.role} status={s.status} />
        ))}
        {contractStatus.contractSentAt && (
          <p className="text-xs text-muted-foreground">
            Sent {formatDate(contractStatus.contractSentAt)}
          </p>
        )}
      </div>
    )
  }

  // State 2: Draft
  if (requestStatus === 'draft') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Contract: Draft</span>
          <span className={`size-2.5 rounded-full ${statusConfig?.dotClass}`} />
        </div>
        {contractStatus.signerStatuses.map(s => (
          <SignerStatusRow key={s.role} role={s.role} status={s.status} />
        ))}
        <div className="flex gap-2">
          <ActionButton
            label="Send for Signing"
            tooltip={ACTION_TOOLTIPS.sendForSigning}
            variant="default"
            onClick={() => submitContract.mutate({ proposalId })}
            disabled={isPending || isCoolingDown}
            cooldownSeconds={isCoolingDown ? remainingSeconds : undefined}
          />
          <ActionButton
            label="Recall"
            tooltip={ACTION_TOOLTIPS.recall}
            variant="destructive"
            onClick={() => recallContract.mutate({ proposalId })}
            disabled={isPending}
          />
        </div>
      </div>
    )
  }

  // State 3: In progress
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Contract: {statusConfig?.label}</span>
        <span className={`size-2.5 rounded-full ${statusConfig?.dotClass}`} />
      </div>
      {contractStatus.signerStatuses.map(s => (
        <SignerStatusRow key={s.role} role={s.role} status={s.status} />
      ))}
      {contractStatus.contractSentAt && (
        <p className="text-xs text-muted-foreground">
          Sent {formatDate(contractStatus.contractSentAt)}
        </p>
      )}
      <div className="flex gap-2">
        <ActionButton
          label="Resend"
          tooltip={ACTION_TOOLTIPS.resend}
          onClick={() => setShowResendConfirm(true)}
          disabled={isPending || isCoolingDown}
          cooldownSeconds={isCoolingDown ? remainingSeconds : undefined}
        />
        <ActionButton
          label="Recall"
          tooltip={ACTION_TOOLTIPS.recall}
          variant="destructive"
          onClick={() => recallContract.mutate({ proposalId })}
          disabled={isPending}
        />
      </div>
      <ResendConfirmDialog
        open={showResendConfirm}
        onOpenChange={setShowResendConfirm}
        onConfirm={() => {
          setShowResendConfirm(false)
          resendContract.mutate({ proposalId })
        }}
      />
    </div>
  )
}

function ResendConfirmDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={props.open} onOpenChange={props.onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Resend Agreement?</AlertDialogTitle>
          <AlertDialogDescription>
            This will invalidate the existing agreement. The homeowner will need to request a new agreement link. Continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={props.onConfirm}>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 2: Verify compilation**

Run: `pnpm tsc --noEmit 2>&1 | grep -v "quickbooks\|webhooks" | grep "error"`

- [ ] **Step 3: Commit**

```bash
git add src/shared/components/contract-status-panel/ui/agent-contract-view.tsx
git commit -m "feat(contract-panel): add AgentContractView with actions, tooltips, cooldown, confirmation"
```

---

## Task 8: HomeownerContractView Component

**Files:**
- Create: `src/shared/components/contract-status-panel/ui/homeowner-contract-view.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/shared/components/contract-status-panel/ui/homeowner-contract-view.tsx
'use client'

import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import type { ZohoContractStatus } from '@/shared/services/zoho-sign/types'
import { Button } from '@/shared/components/ui/button'
import { useTRPC } from '@/trpc/helpers'
import { useCreditCooldown } from '../hooks/use-credit-cooldown'

interface HomeownerContractViewProps {
  proposalId: string
  token: string
  contractStatus: (ZohoContractStatus & { contractSentAt: string | null }) | null
}

export function HomeownerContractView({ proposalId, token, contractStatus }: HomeownerContractViewProps) {
  const trpc = useTRPC()
  const { isCoolingDown, remainingSeconds, startCooldown } = useCreditCooldown()

  const sendContract = useMutation(
    trpc.proposalsRouter.contracts.sendContractForSigning.mutationOptions({
      onSuccess: () => {
        startCooldown()
      },
    }),
  )

  const requestStatus = contractStatus?.requestStatus
  const contractorStatus = contractStatus?.signerStatuses.find(s => s.role === 'Contractor')
  const homeownerStatus = contractStatus?.signerStatuses.find(s => s.role === 'Homeowner')

  // State 5: Declined / Recalled / Expired
  if (requestStatus === 'declined' || requestStatus === 'recalled' || requestStatus === 'expired') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          This agreement is no longer active. Please contact your representative for assistance.
        </p>
        <Button
          onClick={() => sendContract.mutate({ proposalId, token })}
          disabled={sendContract.isPending || isCoolingDown}
        >
          {sendContract.isPending
            ? <><Loader2 className="mr-2 size-4 animate-spin" />Requesting...</>
            : isCoolingDown
              ? `Wait ${remainingSeconds}s...`
              : 'Request New Agreement'}
        </Button>
      </div>
    )
  }

  // State 4: Completed
  if (requestStatus === 'completed') {
    return (
      <p className="text-sm text-green-600">
        Agreement signed! Thank you. Our team will be in touch to schedule your project.
      </p>
    )
  }

  // State 3b: In progress — waiting on homeowner (contractor already signed)
  if (requestStatus === 'inprogress' && contractorStatus?.status === 'SIGNED') {
    return (
      <p className="text-sm text-muted-foreground">
        Your agreement is ready for signature! Please check your email for the signing link from Zoho Sign.
      </p>
    )
  }

  // State 3a: In progress — waiting on contractor
  if (requestStatus === 'inprogress') {
    return (
      <p className="text-sm text-muted-foreground">
        Your agreement has been generated and is being reviewed by our team. You will receive a signing email shortly.
      </p>
    )
  }

  // State 1 & 2: No contract or draft (homeowner doesn't see drafts)
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        No agreement has been generated for this proposal yet. Once you are ready to move forward, click below to alert our office you'd like to proceed with scheduling.
      </p>
      <Button
        onClick={() => sendContract.mutate({ proposalId, token })}
        disabled={sendContract.isPending || isCoolingDown}
      >
        {sendContract.isPending
          ? <><Loader2 className="mr-2 size-4 animate-spin" />Requesting...</>
          : isCoolingDown
            ? `Wait ${remainingSeconds}s...`
            : 'Request Agreement'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/components/contract-status-panel/ui/homeowner-contract-view.tsx
git commit -m "feat(contract-panel): add HomeownerContractView with status messages + request button"
```

---

## Task 9: ContractStatusPanel Main Component

**Files:**
- Create: `src/shared/components/contract-status-panel/ui/contract-status-panel.tsx`

- [ ] **Step 1: Create the main component**

```tsx
// src/shared/components/contract-status-panel/ui/contract-status-panel.tsx
'use client'

import type { ContractStatusPanelProps } from '../types'
import { useContractStatus } from '../hooks/use-contract-status'
import { AgentContractView } from './agent-contract-view'
import { HomeownerContractView } from './homeowner-contract-view'

export function ContractStatusPanel({ proposalId, token, variant, isAgent }: ContractStatusPanelProps) {
  const { data: contractStatus, isLoading } = useContractStatus(proposalId, token)

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-4 w-48 rounded bg-muted" />
      </div>
    )
  }

  if (isAgent) {
    return (
      <AgentContractView
        proposalId={proposalId}
        contractStatus={contractStatus ?? null}
      />
    )
  }

  return (
    <HomeownerContractView
      proposalId={proposalId}
      token={token ?? ''}
      contractStatus={contractStatus ?? null}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/components/contract-status-panel/ui/contract-status-panel.tsx
git commit -m "feat(contract-panel): add ContractStatusPanel main component with agent/homeowner routing"
```

---

## Task 10: Integrate into Proposal Page

**Files:**
- Modify: `src/features/proposal-flow/constants/proposal-steps.ts`
- Modify: `src/features/proposal-flow/ui/components/proposal/index.tsx`

- [ ] **Step 1: Update proposal-steps.ts**

Replace the `send-proposal` and `agreement-link` entries with a single `contract` entry. Import the `ContractStatusPanel`:

```ts
// src/features/proposal-flow/constants/proposal-steps.ts
import type { ProposalStep } from '@/features/proposal-flow/types'
import type { UserRole } from '@/shared/types/enums'
import { ContractStatusPanel } from '@/shared/components/contract-status-panel/ui/contract-status-panel'
import { Funding } from '@/features/proposal-flow/ui/components/proposal/funding'
import { ProjectOverview } from '@/features/proposal-flow/ui/components/proposal/project-overview'
import { RelatedProjects } from '@/features/proposal-flow/ui/components/proposal/related-projects'
import { ScopeOfWork } from '@/features/proposal-flow/ui/components/proposal/scope-of-work'
import { SendProposalLink } from '@/features/proposal-flow/ui/components/proposal/send-proposal-link'
import { TrustedContractor } from '@/features/proposal-flow/ui/components/proposal/trusted-contractor'

export const proposalSteps = [
  {
    title: 'Project Overview',
    accessor: 'project-overview',
    description: 'Project overview',
    Component: ProjectOverview,
    roles: ['homeowner', 'agent'],
  },
  {
    title: 'Trusted Contractor',
    accessor: 'about-tri-pros',
    description: 'About Tri Pros Remodeling',
    Component: TrustedContractor,
    roles: ['homeowner', 'agent'],
  },
  {
    title: 'Past Results',
    accessor: 'related-projects',
    description: 'View similar completed projects from our portfolio',
    Component: RelatedProjects,
    roles: ['homeowner', 'agent'],
  },
  {
    title: 'Scope of Work',
    accessor: 'scope-of-work',
    description: 'Scope of Work',
    Component: ScopeOfWork,
    roles: ['homeowner', 'agent'],
  },
  {
    title: 'Funding',
    accessor: 'funding',
    description: 'Funding',
    Component: Funding,
    roles: ['homeowner', 'agent'],
  },
  {
    title: 'Send Proposal',
    accessor: 'send-proposal',
    description: 'Send proposal link to homeowner',
    Component: SendProposalLink,
    roles: ['agent'],
  },
  {
    title: 'Contract',
    accessor: 'contract',
    description: 'Contract signing status and management',
    Component: ContractStatusPanel,
    roles: ['homeowner', 'agent'],
  },
] as const satisfies ProposalStep<Record<string, any>>[]

export function generateProposalSteps(userRole: UserRole) {
  return proposalSteps.filter((step) => {
    const roles = step.roles as UserRole[]
    return roles.includes(userRole)
  })
}

export type ProposalAccessor = typeof proposalSteps[number]['accessor']
export const customizableSections: ProposalAccessor[] = ['funding', 'send-proposal', 'contract']
```

Note: `AgreementLink` import removed. `send-proposal` kept for agents (email sending). `agreement-link` replaced by `contract`.

- [ ] **Step 2: Update proposal/index.tsx**

In `src/features/proposal-flow/ui/components/proposal/index.tsx`:

Remove these imports (no longer needed):
```ts
import { useTRPC } from '@/trpc/helpers'
```

And the line:
```ts
const sendContract = useMutation(trpc.proposalsRouter.contracts.sendContractForSigning.mutationOptions())
```

Remove the `agreement-link` customizable section block:
```tsx
{customizableSections.includes(step.accessor) && step.accessor === 'agreement-link' && (
  <step.Component
    onClick={() => {
      sendContract.mutate({ proposalId: params.proposalId, token: token ?? '' })
    }}
    isPending={sendContract.isPending}
    isSuccess={sendContract.isSuccess}
  />
)}
```

Replace with the `contract` customizable section:
```tsx
{customizableSections.includes(step.accessor) && step.accessor === 'contract' && (
  <step.Component
    proposalId={params.proposalId}
    token={token ?? undefined}
    variant="full"
    isAgent={ability.can('update', 'Proposal')}
  />
)}
```

Also remove the `useMutation` import if no longer used (check if `recordView` still uses it — it does, so keep it).

Remove the `useTRPC` usage if the only consumer was `sendContract` — check if `recordView` uses it too. If so, keep it.

- [ ] **Step 3: Delete agreement-link.tsx**

```bash
rm src/features/proposal-flow/ui/components/proposal/agreement-link.tsx
```

- [ ] **Step 4: Verify compilation**

Run: `pnpm tsc --noEmit 2>&1 | grep -v "quickbooks\|webhooks" | grep "error"`

Run: `pnpm lint 2>&1 | grep "Error:" | head -5`

Fix import sorting if needed: `pnpm lint --fix`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(proposal): integrate ContractStatusPanel, replace agreement-link + send sections

- proposal-steps: replace agreement-link with contract step (visible to both roles)
- proposal/index.tsx: render ContractStatusPanel with role-based isAgent flag
- Delete agreement-link.tsx (replaced by ContractStatusPanel)"
```
