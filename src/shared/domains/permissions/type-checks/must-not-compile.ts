// Never imported. It exists for `pnpm tsc`: each `@ts-expect-error` line is a mistake the
// permission types must reject. If an edit loosens a type, the line stops erroring and the
// type-check fails with "Unused '@ts-expect-error' directive".

import type z from 'zod'

import type { SpecInsert } from '@/shared/dal/server/types'
import type { insertProjectMediaFilesSchema } from '@/shared/db/schema/project-media-files'
import type { insertProposalSchema } from '@/shared/db/schema/proposals'
import type { ConditionColumnOf, DuplicateFieldsIn, EntitySubject, FieldOf, RowOf, ServerSpecs } from '@/shared/domains/permissions/specs'

import type { projectMediaServerSpec } from '@/shared/modules/projects/media/server-spec'
import { defineEntitySpec, defineSubEntitySpec } from '@/shared/dal/server/lib/define-spec'
import { customers } from '@/shared/db/schema/customers'
import { proposalMediaFiles } from '@/shared/db/schema/proposal-media-files'
import { proposalViews } from '@/shared/db/schema/proposal-views'
import { proposals } from '@/shared/db/schema/proposals'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import { proposalMediaServerSpec } from '@/shared/modules/proposals/media/server-spec'
import { proposalViewServerSpec } from '@/shared/modules/proposals/views/server-spec'

type Expect<T extends true> = T
type Equal<A, B> = (<X>() => X extends A ? 1 : 2) extends (<X>() => X extends B ? 1 : 2) ? true : false
type AssertNever<T extends never> = T

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
