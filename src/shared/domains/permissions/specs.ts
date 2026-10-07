// Types only, so client-safe modules may import this file without pulling server code.

import type { PgTable } from 'drizzle-orm/pg-core'

import type { appSettingServerSpec } from '@/shared/entities/app-settings/lib/server-spec'
import type { applicationServerSpec } from '@/shared/entities/applications/lib/server-spec'
import type { customerNoteServerSpec } from '@/shared/entities/customer-notes/lib/server-spec'
import type { customerLeadAttributionServerSpec, customerProfileServerSpec, customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import type { leadSourceServerSpec } from '@/shared/entities/lead-sources/lib/server-spec'
import type { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
import type { voipCallServerSpec } from '@/shared/entities/voip-calls/lib/server-spec'
import type { voipCampaignContactServerSpec } from '@/shared/entities/voip-campaign-contacts/lib/server-spec'
import type { voipCampaignServerSpec } from '@/shared/entities/voip-campaigns/lib/server-spec'
import type { voipContactFieldServerSpec } from '@/shared/entities/voip-contact-fields/lib/server-spec'
import type { voipDidServerSpec } from '@/shared/entities/voip-dids/lib/server-spec'
import type { voipLinkTokenServerSpec } from '@/shared/entities/voip-link-tokens/lib/server-spec'
import type { voipMessageServerSpec } from '@/shared/entities/voip-messages/lib/server-spec'
import type { projectServerSpec } from '@/shared/modules/projects/core/server-spec'
import type { projectMediaServerSpec } from '@/shared/modules/projects/media/server-spec'
import type { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import type { proposalIncentiveServerSpec } from '@/shared/modules/proposals/incentives/server-spec'
import type { proposalMediaServerSpec } from '@/shared/modules/proposals/media/server-spec'
import type { proposalViewServerSpec } from '@/shared/modules/proposals/views/server-spec'

/** Every spec. A spec missing here is invisible to rule typing. */
export type ServerSpec
  = | typeof appSettingServerSpec
    | typeof applicationServerSpec
    | typeof customerLeadAttributionServerSpec
    | typeof customerNoteServerSpec
    | typeof customerProfileServerSpec
    | typeof customerServerSpec
    | typeof leadSourceServerSpec
    | typeof meetingServerSpec
    | typeof projectMediaServerSpec
    | typeof projectServerSpec
    | typeof proposalIncentiveServerSpec
    | typeof proposalMediaServerSpec
    | typeof proposalServerSpec
    | typeof proposalViewServerSpec
    | typeof voipCallServerSpec
    | typeof voipCampaignContactServerSpec
    | typeof voipCampaignServerSpec
    | typeof voipContactFieldServerSpec
    | typeof voipDidServerSpec
    | typeof voipLinkTokenServerSpec
    | typeof voipMessageServerSpec

type EntitySpecs = Extract<ServerSpec, { subject: string }>
type ColumnKey<TTable extends PgTable> = keyof TTable['$inferSelect'] & string

export type EntitySubject = EntitySpecs['subject']
export type SpecOf<S extends EntitySubject> = Extract<EntitySpecs, { subject: S }>
export type RowOf<S extends EntitySubject> = SpecOf<S>['table']['$inferSelect']
export type ConditionColumnOf<S extends EntitySubject> = SpecOf<S>['conditionColumns'][number]

type SubEntitiesOf<TParent> = ServerSpec extends infer TSpec
  ? TSpec extends { parent: { spec: TParent, field: string } } ? TSpec : never
  : never

type SubEntityPath<TParent> = SubEntitiesOf<TParent> extends infer TChild
  ? TChild extends { table: infer TTable extends PgTable, parent: { field: infer TField extends string } }
    ? TField | `${TField}.*` | `${TField}.**` | `${TField}.${ColumnKey<TTable>}` | `${TField}.${SubEntityPath<TChild>}`
    : never
  : never

/** What a rule may list as a field of `S`: its columns, and every sub-entity path under it. */
export type FieldOf<S extends EntitySubject> = ColumnKey<SpecOf<S>['table']> | SubEntityPath<SpecOf<S>>

// `boolean`, not `true`, when one member is a subtype of another: callers test `true extends IsUnion<…>`.
type IsUnion<T, U = T> = T extends unknown ? ([U] extends [T] ? false : true) : never

/** The subjects claimed by more than one entity spec; `never` when there are none. */
export type DuplicateSubjectsIn<TSpecs, TAll = TSpecs> = TSpecs extends { subject: infer TSubject extends string }
  ? true extends IsUnion<Extract<TAll, { subject: TSubject }>> ? TSubject : never
  : never

/** The field names claimed by more than one sub-entity of the same parent; `never` when there are none. */
export type DuplicateFieldsIn<TSpecs, TAll = TSpecs> = TSpecs extends { parent: { spec: infer TParent, field: infer TField extends string } }
  ? true extends IsUnion<Extract<TAll, { parent: { spec: TParent, field: TField } }>> ? TField : never
  : never
