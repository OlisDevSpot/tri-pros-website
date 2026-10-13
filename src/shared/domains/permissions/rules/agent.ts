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

    // A project is reached through the meetings on it; the row filter and the UI read this one rule.
    can('read', 'Project', { $participatesViaMeeting: { via: 'projectId', userId } })
    can('create', 'Project')
    can('update', 'Project')
    // Publishing puts a customer's job on the public site: the office decides.
    cannot('update', 'Project', ['isPublic'])

    can(['read', 'create', 'update', 'delete'], 'Activity')
    can('manage', 'Calendar')

    // Read only: leads, rehash and dead pipelines are super-admin-managed.
    can('read', 'CustomerPipeline')

    can('read', 'User')

    // Row scoping (own rows only) is enforced by entity visibility predicates until these families convert.
    can('read', 'VoipCall')
    can('create', 'VoipCall') // placeAgentCall via softphone

    can('read', 'VoipMessage')
    can('create', 'VoipMessage') // sendSms via thread UI

    can('read', 'VoipDid') // resolve own sticky DID

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
