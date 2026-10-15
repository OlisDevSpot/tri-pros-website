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
    // A rep removes only what they booked; a meeting the office handed them is the office's to remove.
    can('delete', 'Meeting', { setBy: userId })
    can('own', 'Meeting') // agents own the meetings they create (implicitly the sales rep)
    // Ownership moves with the participants, and who set a meeting with the office, both through `assign`.
    cannot('update', 'Meeting', ['ownerId', 'setBy'])

    // A proposal is reached through the meeting it was made in; the row filter and the UI read this one rule.
    can('read', 'Proposal', { $participatesViaMeeting: { via: 'meetingId', userId } })
    can('create', 'Proposal')
    // A draft is the rep's work in progress; once it has gone out, it is the customer's record.
    can('delete', 'Proposal', { status: 'draft' })
    // What a rep builds and sends. The share link, the contract trail, the books, the created date and
    // the meeting a proposal belongs to are the system's or the office's.
    can('update', 'Proposal', [
      'label',
      'priceDisplayMode',
      'projectJSON',
      'startingTcpCents',
      'depositAmountCents',
      'cashInDealCents',
      'miscPriceCents',
      'financeOptionId',
      'status',
      'sentAt',
      'approvedAt',
      // Choosing the documents is the rep's; the reconciled selection is written as a derived system write.
      'envelopeDocumentIds',
      'incentives',
      'incentives.*',
      'media',
      'media.*',
    ])

    can('read', 'Application')
    can('create', 'Application')
    can('update', 'Application')

    // A project is reached through the meetings on it; the row filter and the UI read this one rule.
    can('read', 'Project', { $participatesViaMeeting: { via: 'projectId', userId } })
    can('create', 'Project')
    can('update', 'Project')
    // Publishing puts a customer's job on the public site: the office decides. A project's customer is
    // set from its meeting when it is created, and a project has no owner to move.
    cannot('update', 'Project', ['isPublic', 'customerId', 'ownerId'])

    // An activity is its owner's note about a record. Reading it also takes that record, so a customer or
    // meeting handed to someone else takes its reminders out of reach with it.
    can('read', 'Activity', { ownerId: userId, $linkedRecordInReach: true })
    can(['create', 'update', 'delete'], 'Activity', { ownerId: userId })
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
