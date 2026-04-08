'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckIcon, FileTextIcon, FolderOpenIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Separator } from '@/shared/components/ui/separator'
import { invalidateMeeting, invalidateProject, invalidateProposal } from '@/shared/dal/client/invalidation'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

interface AssignProjectDialogProps {
  meetingId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AssignProjectDialog({ meetingId, open, onOpenChange }: AssignProjectDialogProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  const dataQuery = useQuery({
    ...trpc.meetingsRouter.getCustomerProjects.queryOptions({ meetingId: meetingId! }),
    enabled: open && !!meetingId,
  })

  const assignMutation = useMutation(
    trpc.meetingsRouter.assignToProject.mutationOptions({
      onSuccess: () => {
        invalidateMeeting(queryClient)
        invalidateProject(queryClient)
        toast.success('Meeting assigned to project')
        handleClose()
      },
      onError: () => toast.error('Failed to assign meeting to project'),
    }),
  )

  const approveProposalMutation = useMutation(
    trpc.proposalsRouter.crud.updateProposal.mutationOptions({
      onSuccess: () => {
        invalidateProposal(queryClient)
        invalidateProject(queryClient)
        toast.success('Proposal approved — a project will be created')
      },
      onError: () => toast.error('Failed to approve proposal'),
    }),
  )

  function handleClose() {
    onOpenChange(false)
    setSelectedProjectId(null)
  }

  function handleAssign() {
    if (!selectedProjectId || !meetingId) {
      return
    }
    assignMutation.mutate({ meetingId, projectId: selectedProjectId })
  }

  function handleApproveProposal(proposalId: string) {
    approveProposalMutation.mutate({ proposalId, data: { status: 'approved' } })
  }

  const customerProjects = dataQuery.data?.projects ?? []
  const meetingProposals = dataQuery.data?.proposals ?? []
  const approvableProposals = meetingProposals.filter(p => p.status === 'sent' || p.status === 'draft')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign to Project</DialogTitle>
          <DialogDescription>
            Select an existing project or approve a proposal to create one.
          </DialogDescription>
        </DialogHeader>

        {/* Existing projects */}
        {customerProjects.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Customer Projects
            </p>
            <div className="max-h-48 overflow-y-auto -mx-1 space-y-0.5">
              {customerProjects.map(project => (
                <button
                  key={project.id}
                  type="button"
                  className={cn(
                    'flex items-center gap-2.5 w-full rounded-md px-3 py-2.5 text-left transition-colors cursor-pointer',
                    'hover:bg-muted/50',
                    selectedProjectId === project.id && 'bg-primary/10',
                  )}
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  <FolderOpenIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{project.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {project.pipelineStage?.replace(/_/g, ' ') ?? project.status}
                    </p>
                  </div>
                  {selectedProjectId === project.id && (
                    <CheckIcon className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state + approvable proposals */}
        {customerProjects.length === 0 && !dataQuery.isLoading && (
          <p className="text-sm text-muted-foreground text-center py-2">
            No projects for this customer yet.
          </p>
        )}

        {dataQuery.isLoading && (
          <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
        )}

        {/* Approvable proposals section */}
        {approvableProposals.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Approve a Proposal to Create Project
              </p>
              <div className="space-y-1">
                {approvableProposals.map(proposal => (
                  <div
                    key={proposal.id}
                    className="flex items-center justify-between gap-2 rounded-md px-3 py-2 bg-muted/30"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileTextIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-sm truncate">{proposal.label || 'Untitled'}</span>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {proposal.status}
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs shrink-0"
                      disabled={approveProposalMutation.isPending}
                      onClick={() => handleApproveProposal(proposal.id)}
                    >
                      <PlusIcon className="h-3 w-3" />
                      Approve
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedProjectId || assignMutation.isPending}
          >
            {assignMutation.isPending ? 'Assigning...' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
