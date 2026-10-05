// Never imported. It exists for `pnpm tsc`: each `@ts-expect-error` line is a mistake the
// permission types must reject. If an edit loosens a type, the line stops erroring and the
// type-check fails with "Unused '@ts-expect-error' directive".

import type z from 'zod'

import type { SpecInsert } from '@/shared/dal/server/types'
import type { insertProjectMediaFilesSchema } from '@/shared/db/schema/project-media-files'
import type { insertProposalSchema } from '@/shared/db/schema/proposals'
import type { OperatorName, ReadOperators } from '@/shared/domains/permissions/operators'
import type { ConditionColumnOf, DuplicateFieldsIn, DuplicateSubjectsIn, EntitySubject, FieldOf, RowOf, ServerSpecs } from '@/shared/domains/permissions/specs'

import type { projectMediaServerSpec } from '@/shared/modules/projects/media/server-spec'
import { defineEntitySpec, defineSubEntitySpec } from '@/shared/dal/server/lib/define-spec'
import { customerNotes } from '@/shared/db/schema/customer-notes'
import { customers } from '@/shared/db/schema/customers'
import { proposalMediaFiles } from '@/shared/db/schema/proposal-media-files'
import { proposalViews } from '@/shared/db/schema/proposal-views'
import { proposals } from '@/shared/db/schema/proposals'
import { defineRules } from '@/shared/domains/permissions/rules/define-rules'
import { customerNoteServerSpec } from '@/shared/entities/customer-notes/lib/server-spec'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import { proposalMediaServerSpec } from '@/shared/modules/proposals/media/server-spec'
import { proposalViewServerSpec } from '@/shared/modules/proposals/views/server-spec'

type Expect<T extends true> = T
type Equal<A, B> = (<X>() => X extends A ? 1 : 2) extends (<X>() => X extends B ? 1 : 2) ? true : false
type AssertNever<T extends never> = T
type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never

// ── spec constructors ──────────────────────────────────────────────────────

// @ts-expect-error the foreign key belongs to another table
defineSubEntitySpec({ entityName: 'ProposalView', table: proposalViews, schemas: proposalViewServerSpec.schemas, parent: { spec: proposalServerSpec, fk: proposals.id, field: 'views2' } })
// @ts-expect-error the field name shadows a real column of the parent
defineSubEntitySpec({ entityName: 'ProposalView', table: proposalViews, schemas: proposalViewServerSpec.schemas, parent: { spec: proposalServerSpec, fk: proposalViews.proposalId, field: 'status' } })
// @ts-expect-error a sub-entity has no token column of its own
defineSubEntitySpec({ entityName: 'ProposalView', table: proposalViews, schemas: proposalViewServerSpec.schemas, shareable: { tokenColumn: 'id' }, parent: { spec: proposalServerSpec, fk: proposalViews.proposalId, field: 'views2' } })
// @ts-expect-error a condition column must be a column of the table
defineEntitySpec({ entityName: 'Customer', subject: 'Customer', table: customers, schemas: customerServerSpec.schemas, conditionColumns: ['nope'] })
// @ts-expect-error the primary key must be a column of the table
defineEntitySpec({ entityName: 'Customer', subject: 'Customer', table: customers, schemas: customerServerSpec.schemas, conditionColumns: [], primaryKey: 'nope' })
// @ts-expect-error the token column must be a column of the table
defineEntitySpec({ entityName: 'Proposal', subject: 'Proposal', table: proposals, schemas: proposalServerSpec.schemas, conditionColumns: [], shareable: { tokenColumn: 'nope' } })
// @ts-expect-error the subject must be a known entity name
defineEntitySpec({ entityName: 'Customer', subject: 'Custmer', table: customers, schemas: customerServerSpec.schemas, conditionColumns: [] })
declare const widenedField: string
// @ts-expect-error a field name widened to string would switch off every field check on the parent
defineSubEntitySpec({ entityName: 'ProposalView', table: proposalViews, schemas: proposalViewServerSpec.schemas, parent: { spec: proposalServerSpec, fk: proposalViews.proposalId, field: widenedField } })
// @ts-expect-error a field name cannot contain the path separator
defineSubEntitySpec({ entityName: 'ProposalView', table: proposalViews, schemas: proposalViewServerSpec.schemas, parent: { spec: proposalServerSpec, fk: proposalViews.proposalId, field: 'views.more' } })
// @ts-expect-error a field name cannot contain a wildcard
defineSubEntitySpec({ entityName: 'ProposalView', table: proposalViews, schemas: proposalViewServerSpec.schemas, parent: { spec: proposalServerSpec, fk: proposalViews.proposalId, field: 'views*' } })
// @ts-expect-error a field name cannot be empty
defineSubEntitySpec({ entityName: 'ProposalView', table: proposalViews, schemas: proposalViewServerSpec.schemas, parent: { spec: proposalServerSpec, fk: proposalViews.proposalId, field: '' } })
// @ts-expect-error an entity is named by its subject
defineEntitySpec({ entityName: 'Customer', subject: 'Proposal', table: customers, schemas: customerServerSpec.schemas, conditionColumns: [] })
// @ts-expect-error an entity's parent link takes no field
defineEntitySpec({ entityName: 'CustomerNote', subject: 'CustomerNote', table: customerNotes, schemas: customerNoteServerSpec.schemas, conditionColumns: ['authorId'], parent: { spec: customerServerSpec, fk: customerNotes.customerId, field: 'notes' } })
export const entityUnderParent = defineEntitySpec({ entityName: 'CustomerNote', subject: 'CustomerNote', table: customerNotes, schemas: customerNoteServerSpec.schemas, conditionColumns: ['authorId'], parent: { spec: customerServerSpec, fk: customerNotes.customerId } })

// ── the constructors keep the schemas precise ──────────────────────────────

export type SchemasStayPrecise = [
  Expect<Equal<SpecInsert<typeof proposalServerSpec>, z.input<typeof insertProposalSchema>>>,
  Expect<Equal<SpecInsert<typeof projectMediaServerSpec>, z.input<typeof insertProjectMediaFilesSchema>>>,
]

// ── what the list derives ──────────────────────────────────────────────────

export type TheListIsExact = [
  Expect<Equal<EntitySubject, 'AppSetting' | 'Application' | 'Customer' | 'CustomerNote' | 'LeadSource' | 'Meeting' | 'Project' | 'Proposal' | 'VoipCall' | 'VoipCampaign' | 'VoipCampaignContact' | 'VoipContactField' | 'VoipDid' | 'VoipLinkToken' | 'VoipMessage'>>,
  Expect<Equal<ConditionColumnOf<'CustomerNote'>, 'authorId'>>,
  Expect<Equal<ConditionColumnOf<'Customer'>, never>>,
  Expect<Equal<RowOf<'Proposal'>['status'], 'approved' | 'declined' | 'draft' | 'sent'>>,
]

export const proposalFields: FieldOf<'Proposal'>[] = ['status', 'views', 'views.*', 'views.**', 'views.viewedAt', 'incentives', 'media', 'media.**']
export const projectFields: FieldOf<'Project'>[] = ['title', 'media', 'media.phase']
export const customerFields: FieldOf<'Customer'>[] = ['age', 'name', 'phone', 'email', 'address', 'city', 'state', 'zip', 'pipelineStage']

// @ts-expect-error not a field of Proposal
export const fieldTypo: FieldOf<'Proposal'> = 'veiws'
// @ts-expect-error not a column of proposal_views
export const subEntityColumnTypo: FieldOf<'Proposal'> = 'views.nope'
// @ts-expect-error `views` belongs to Proposal, not Customer
export const otherParentsField: FieldOf<'Customer'> = 'views'
// @ts-expect-error a customer note has its own subject: it is not a field of Customer
export const ownSubjectIsNotAField: FieldOf<'Customer'> = 'notes'

// ── one field name per parent ──────────────────────────────────────────────

export type NoDuplicateFields = AssertNever<DuplicateFieldsIn<ServerSpecs>>

const _secondViews = defineSubEntitySpec({ entityName: 'ProposalMediaFile', table: proposalMediaFiles, schemas: proposalMediaServerSpec.schemas, parent: { spec: proposalServerSpec, fk: proposalMediaFiles.proposalId, field: 'views' } })
// @ts-expect-error two sub-entities claim `views` under Proposal
export type DuplicateIsCaught = AssertNever<DuplicateFieldsIn<ServerSpecs | typeof _secondViews>>

// ── one spec per subject, one declaration per operator ─────────────────────

export type NoDuplicateSubjects = AssertNever<DuplicateSubjectsIn<ServerSpecs>>

const _secondCustomer = defineEntitySpec({ entityName: 'Customer', subject: 'Customer', table: customers, schemas: customerServerSpec.schemas, conditionColumns: ['id'] })
// @ts-expect-error two entity specs claim Customer
export type DuplicateSubjectIsCaught = AssertNever<DuplicateSubjectsIn<ServerSpecs | typeof _secondCustomer>>

export type OperatorNamesMatchDeclarations = Expect<Equal<keyof UnionToIntersection<ReadOperators[keyof ReadOperators]>, `$${OperatorName}`>>

// ── rules ──────────────────────────────────────────────────────────────────

const userId = 'user-1'
const proposalId = 'proposal-1'
const conditionsBuiltElsewhere = { token: 'x' }
const operatorBuiltElsewhere = { $participatesViaMeeting: { via: 'customerId' as const, userId } }
const sharedFields = ['name', 'phone'] as const
declare const maybeUserId: string | undefined
declare const optionalConditions: { ownerId?: string }
const emptyConditions = {}
declare const anyAction: 'create' | 'delete' | 'read' | 'update'
declare const maybeConditions: { ownerId: string } | undefined
declare const maybeProposalConditions: { id: string } | undefined
declare const maybeNoteConditions: { authorId: string } | undefined

export const rulesThatMustCompile = defineRules((can, cannot) => {
  can('manage', 'all')
  can('access', 'Dashboard')
  can('own', 'Meeting')
  can('read', 'User')
  can(['read', 'create', 'update', 'delete'], 'Activity')

  can('read', 'Customer', { $participatesViaMeeting: { via: 'customerId', userId } })
  can('read', 'Customer', { $inDerivedPipeline: ['leads', 'rehash', 'dead', 'fresh'] })
  can('update', 'Customer', ['age'])
  can('update', 'Customer', ['name', 'phone', 'email', 'address', 'city', 'state', 'zip', 'pipelineStage'])

  can('read', 'Proposal', { id: proposalId })
  can('update', 'Proposal', ['financeOptionId', 'cashInDealCents', 'views'], { id: proposalId })
  can('read', 'Proposal', { $participatesViaMeeting: { via: 'meetingId', userId } })
  cannot('update', 'Proposal', ['incentives', 'incentives.*'], { id: proposalId })

  can('read', 'Meeting', { $participatesViaMeeting: { via: 'self', userId } })
  can('read', 'Project', { $participatesViaMeeting: { via: 'projectId', userId } })
  can('read', 'Project', { ownerId: userId })
  can(['update', 'delete'], 'CustomerNote', { authorId: userId })
  can('read', 'VoipCall', { agentUserId: { $in: [userId] } })
  can('read', 'Customer', operatorBuiltElsewhere)
  can('update', 'Proposal', ['views'])
  cannot('delete', 'CustomerNote')
  can('update', 'Customer', sharedFields)
  can('read', 'VoipCall', { agentUserId: null })
  can(anyAction, 'Project')
  can('read', 'Application')
  cannot(['update', 'delete'], 'Proposal')
}).length

defineRules((can, cannot) => {
  // @ts-expect-error typo in a field
  can('update', 'Customer', ['agee'])
  // @ts-expect-error typo in a field of a cannot: the restriction would silently not apply
  cannot('update', 'Proposal', ['incentivs'], { id: proposalId })
  // @ts-expect-error a Proposal field named on Customer
  can('update', 'Customer', ['views'])
  // @ts-expect-error not a column of the sub-entity's table
  can('update', 'Proposal', ['views.nope'])
  // @ts-expect-error a condition on a column that is not a declared condition column
  can('update', 'Proposal', { token: 'x' })
  // @ts-expect-error a condition value of the wrong type
  can('read', 'Proposal', { id: 42 })
  // @ts-expect-error an operator on a mutation rule
  can('update', 'Customer', { $participatesViaMeeting: { via: 'customerId', userId } })
  // @ts-expect-error an operator together with a field list
  can('read', 'Customer', ['age'], { $participatesViaMeeting: { via: 'customerId', userId } })
  // @ts-expect-error an operator on a cannot
  cannot('read', 'Customer', { $participatesViaMeeting: { via: 'customerId', userId } })
  // @ts-expect-error an operator that this subject does not declare
  can('read', 'Proposal', { $inDerivedPipeline: ['leads'] })
  // @ts-expect-error a `via` this subject's table cannot join through
  can('read', 'Customer', { $participatesViaMeeting: { via: 'meetingId', userId } })
  // @ts-expect-error not a pipeline
  can('read', 'Customer', { $inDerivedPipeline: ['nope'] })
  // @ts-expect-error an action that does not exist for an entity
  can('access', 'Customer')
  // @ts-expect-error `own` is declared for Meeting only
  can('own', 'Proposal')
  // @ts-expect-error unknown subject
  can('read', 'Custmer')
  // @ts-expect-error a subject without a spec takes no fields
  can('read', 'User', ['name'])
  // @ts-expect-error a subject without a spec takes no conditions
  can('read', 'User', { id: userId })

  // An entity with no condition columns has an empty conditions type; an empty type must not accept everything.
  // @ts-expect-error no condition columns: no conditions on a mutation
  can('update', 'Application', { anything: 1 })
  // @ts-expect-error no condition columns and no operator: no conditions on a read
  can('read', 'Application', { anything: 1 })
  // @ts-expect-error an unknown key beside a valid operator
  can('read', 'Customer', { $participatesViaMeeting: { via: 'customerId', userId }, extra: 1 })
  // @ts-expect-error conditions built elsewhere are checked too: undeclared column
  can('update', 'Proposal', conditionsBuiltElsewhere)
  // @ts-expect-error conditions built elsewhere are checked too: operator on a mutation
  can('update', 'Customer', operatorBuiltElsewhere)
  // @ts-expect-error a field list is never read as conditions
  can('update', 'Proposal', ['veiws'])
  // @ts-expect-error a field list is never read as conditions (cannot)
  cannot('update', 'Proposal', ['veiws'])

  // A condition that may be `undefined` would drop the filter it stands for.
  // @ts-expect-error a condition value that may be undefined
  can('read', 'Project', { ownerId: maybeUserId })
  // @ts-expect-error a condition value that is undefined
  can('read', 'Project', { ownerId: undefined })
  // @ts-expect-error conditions whose key may be absent
  can('read', 'Project', optionalConditions)
  // @ts-expect-error an operator that is undefined
  can('read', 'Customer', { $participatesViaMeeting: undefined })
  // @ts-expect-error an operator payload that may be undefined
  can('read', 'Customer', { $participatesViaMeeting: { via: 'customerId', userId: maybeUserId } })
  // @ts-expect-error a value inside $in that may be undefined
  can('read', 'VoipCall', { agentUserId: { $in: [maybeUserId] } })
  // @ts-expect-error a cannot condition that may be undefined
  cannot('update', 'CustomerNote', { authorId: maybeUserId })

  // @ts-expect-error an empty field list
  can('update', 'Customer', [])
  // @ts-expect-error an empty field list on a cannot
  cannot('update', 'Proposal', [])
  // @ts-expect-error an empty field list with conditions
  can('update', 'Proposal', [], { id: proposalId })
  // @ts-expect-error a mistyped field list on a read of an entity with no condition columns
  can('read', 'Customer', ['agee'])
  // @ts-expect-error a widened list of strings is not a field list
  can('update', 'Customer', ['age'] as string[])

  // A conditions argument that may be absent would leave a rule with no conditions.
  // @ts-expect-error conditions that may be undefined
  can('read', 'Project', maybeConditions)
  // @ts-expect-error conditions that may be undefined, after a field list
  can('update', 'Proposal', ['views'], maybeProposalConditions)
  // @ts-expect-error conditions that may be undefined on a cannot
  cannot('update', 'CustomerNote', maybeNoteConditions)
  // @ts-expect-error an empty conditions object: a rule without conditions is written without the argument
  can('read', 'Project', {})
  // @ts-expect-error an empty conditions object held in a variable
  can('read', 'Project', emptyConditions)
  // @ts-expect-error an empty conditions object on an entity with no condition columns
  can('update', 'Application', {})
  // @ts-expect-error an empty conditions object after a field list
  can('update', 'Proposal', ['views'], {})
})
