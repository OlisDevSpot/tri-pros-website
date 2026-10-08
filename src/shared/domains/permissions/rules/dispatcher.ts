import { defineRules } from './define-rules'

// Internal lead-qualifier, NOT a sales agent: deliberately without can('own','Meeting'),
// so the appointments they book land unassigned (system-owned) for the dispatch flow.
export function dispatcherRules(userId: string) {
  return defineRules((can, cannot) => {
    can('access', 'Dashboard')
    can('read', 'LeadsPool') // the shared leads pool drives phone and pipeline access

    // The operational pipeline: every lead bucket, never a customer who holds a project.
    can('read', 'Customer', { $inDerivedPipeline: ['leads', 'rehash', 'dead', 'fresh'] })
    // Lead-contact fields and the discovery profile: collecting a customer's data is the dispatcher's job.
    can('update', 'Customer', ['name', 'phone', 'email', 'address', 'city', 'state', 'zip', 'pipelineStage', 'profile', 'profile.*'])

    // Dispatchers qualify leads, so they work notes exactly like agents: a customer's notes are read with the customer, and only the author edits or deletes.
    can('read', 'CustomerNote')
    can('create', 'CustomerNote')
    can(['update', 'delete'], 'CustomerNote', { authorId: userId })

    // Every meeting, project meetings included: the dispatcher schedules the agents' days.
    can('read', 'Meeting')
    can('create', 'Meeting') // books appointments (lands unassigned — see resolve-owner.ts)
    can('update', 'Meeting')
    // The in-meeting deal structure is pricing. Not readable, so not writable either.
    cannot(['read', 'update'], 'Meeting', ['flowStateJSON'])

    can('read', 'User')

    can('read', 'VoipCall')
    can('create', 'VoipCall')
    can('read', 'VoipMessage')
    can('create', 'VoipMessage')
    can('read', 'VoipDid')
  })
}
