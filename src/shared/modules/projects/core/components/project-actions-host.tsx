'use client'

import type { ReactNode } from 'react'

import { createContext, use, useMemo } from 'react'

import { useProjectActionConfigs } from '@/shared/modules/projects/core/hooks/use-project-action-configs'

interface ProjectActionsHostValue {
  actions: ReturnType<typeof useProjectActionConfigs>['actions']
}

const ProjectActionsHostContext = createContext<ProjectActionsHostValue | null>(null)

interface ProjectActionsHostProps {
  /** View-level handlers. Each takes the entity, so one `actions` array serves every card below the host. */
  overrides?: Parameters<typeof useProjectActionConfigs>[0]
  children: ReactNode
}

export function ProjectActionsHost({ overrides, children }: ProjectActionsHostProps) {
  const { actions, DeleteConfirmDialog } = useProjectActionConfigs(overrides)
  // `actions` keeps its identity while its loading flag does, so the cards below only re-render for that.
  const value = useMemo<ProjectActionsHostValue>(() => ({ actions }), [actions])

  return (
    <ProjectActionsHostContext value={value}>
      <DeleteConfirmDialog />
      {children}
    </ProjectActionsHostContext>
  )
}

export function useProjectActionsHost(consumer: string): ProjectActionsHostValue {
  const value = use(ProjectActionsHostContext)
  if (!value) {
    throw new Error(`${consumer} needs a <ProjectActionsHost> above it`)
  }
  return value
}
