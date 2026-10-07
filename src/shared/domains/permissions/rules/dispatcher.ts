import { defineRules } from './define-rules'

// Internal lead-qualifier, NOT a sales agent: deliberately without can('own','Meeting'),
// so the appointments they book land unassigned (system-owned) for the dispatch flow.
export function dispatcherRules(userId: string) {
  return defineRules((can) => {
    can('access', 'Dashboard')
    can('read', 'LeadsPool') // the shared leads pool drives phone and pipeline access

    // The shared leads pool: customers no meeting has claimed yet.
    can('read', 'Customer', { $inDerivedPipeline: ['leads'] })
    // Lead-contact fields only — not the sales-discovery profile.
    can('update', 'Customer', ['name', 'phone', 'email', 'address', 'city', 'state', 'zip', 'pipelineStage'])

    // Dispatchers qualify leads, so they work notes exactly like agents: a customer's notes are read with the customer, and only the author edits or deletes.
    can('read', 'CustomerNote')
    can('create', 'CustomerNote')
    can(['update', 'delete'], 'CustomerNote', { authorId: userId })

    can('read', 'Meeting')
    can('create', 'Meeting') // books appointments (lands unassigned — see resolve-owner.ts)
    can('update', 'Meeting')

    can('read', 'User')

    can('read', 'VoipCall')
    can('create', 'VoipCall')
    can('read', 'VoipMessage')
    can('create', 'VoipMessage')
    can('read', 'VoipDid')
  })
}
