import { appSettingServerSpec } from '@/shared/entities/app-settings/lib/server-spec'
import { applicationServerSpec } from '@/shared/entities/applications/lib/server-spec'
import { customerNoteServerSpec } from '@/shared/entities/customer-notes/lib/server-spec'
import { customerLeadAttributionServerSpec, customerProfileServerSpec, customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import { leadSourceServerSpec } from '@/shared/entities/lead-sources/lib/server-spec'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
import { voipCallServerSpec } from '@/shared/entities/voip-calls/lib/server-spec'
import { voipCampaignContactServerSpec } from '@/shared/entities/voip-campaign-contacts/lib/server-spec'
import { voipCampaignServerSpec } from '@/shared/entities/voip-campaigns/lib/server-spec'
import { voipContactFieldServerSpec } from '@/shared/entities/voip-contact-fields/lib/server-spec'
import { voipDidServerSpec } from '@/shared/entities/voip-dids/lib/server-spec'
import { voipLinkTokenServerSpec } from '@/shared/entities/voip-link-tokens/lib/server-spec'
import { voipMessageServerSpec } from '@/shared/entities/voip-messages/lib/server-spec'
import { projectServerSpec } from '@/shared/modules/projects/core/server-spec'
import { projectMediaServerSpec } from '@/shared/modules/projects/media/server-spec'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import { proposalIncentiveServerSpec } from '@/shared/modules/proposals/incentives/server-spec'
import { proposalMediaServerSpec } from '@/shared/modules/proposals/media/server-spec'
import { proposalViewServerSpec } from '@/shared/modules/proposals/views/server-spec'

/** Every spec, for the checks that need them at run time. The type list in `permissions/specs.ts` is what rules are typed against; the wrong-on-purpose file keeps the two equal. */
export const SERVER_SPECS = [
  appSettingServerSpec,
  applicationServerSpec,
  customerLeadAttributionServerSpec,
  customerNoteServerSpec,
  customerProfileServerSpec,
  customerServerSpec,
  leadSourceServerSpec,
  meetingServerSpec,
  projectMediaServerSpec,
  projectServerSpec,
  proposalIncentiveServerSpec,
  proposalMediaServerSpec,
  proposalServerSpec,
  proposalViewServerSpec,
  voipCallServerSpec,
  voipCampaignContactServerSpec,
  voipCampaignServerSpec,
  voipContactFieldServerSpec,
  voipDidServerSpec,
  voipLinkTokenServerSpec,
  voipMessageServerSpec,
] as const
