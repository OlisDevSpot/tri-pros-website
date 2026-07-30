import type { applicationStatuses, applicationTypes } from '@/shared/constants/enums/applications'

export type ApplicationType = (typeof applicationTypes)[number]
export type ApplicationStatus = (typeof applicationStatuses)[number]
