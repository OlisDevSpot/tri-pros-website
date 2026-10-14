import { defineRules } from './define-rules'

export function agentRules(userId: string) {
  return defineRules((can, cannot) => {
    can('access', 'Dashboard')

    // A customer is reached through a meeting the agent sits in; the row filter and the UI read this one rule.
    can('read', 'Customer', { $participatesViaMeeting: { via: 'customerId', userId } })
    // `age` and the discovery profile are the only parts of a customer an agent writes; customers are created by the office.
    can('update', 'Customer', ['age', 'profile', 'profile.*'])

    can('read', 'CustomerNote')
    can('create', 'CustomerNote')
    can(['update', 'delete'], 'CustomerNote', { authorId: userId })

    // A meeting is reached by sitting in it; the row filter and the UI read this one rule.
    can('read', 'Meeting', { $participatesViaMeeting: { via: 'self', userId } })
    can('create', 'Meeting')
    can('update', 'Meeting')
    can('own', 'Meeting') // agents own the meetings they create (implicitly the sales rep)

    // A proposal is reached through the meeting it was made in; the row filter and the UI read this one rule.
    can('read', 'Proposal', { $participatesViaMeeting: { via: 'meetingId', userId } })
    can('create', 'Proposal')
    can('update', 'Proposal')

    can('read', 'Application')
    can('create', 'Application')
    can('update', 'Application')

    can('read', 'Project')
    can('create', 'Project')
    can('update', 'Project')

    can(['read', 'create', 'update', 'delete'], 'Activity')
    can('manage', 'Calendar')

    // Read only: leads, rehash and dead pipelines are super-admin-managed.
    can('read', 'CustomerPipeline')

    can('read', 'User')

    // Calls are still scoped by the legacy visibility predicate (own rows only); texts are reached through the agent's line.
    can('read', 'VoipCall')
    can('create', 'VoipCall') // placeAgentCall via softphone

    can('read', 'VoipMessage')
    can('create', 'VoipMessage') // sendSms via thread UI

    // An agent's own line, and through it that line's texts.
    can('read', 'VoipDid', { assignedUserId: userId })
    // An agent's own-line conversations arrive with the post-meeting build; until then an agent reaches none.
    cannot('read', 'VoipDid', ['conversations', 'conversations.*'])

    can('read', 'VoipLinkToken')
    can('create', 'VoipLinkToken') // mint L-DOC links

    // Resync, source binding and bulk enroll-all are super-admin-only — no agent rule for those.
    can('read', 'VoipCampaign')
    can('read', 'VoipContactField')
    can('read', 'VoipCampaignContact')
    can('update', 'VoipCampaignContact') // disqualify (unenroll) a lead

  // No agent rule for AppSetting — super-admin only via the 'manage' on 'all'.
  })
}
