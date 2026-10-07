import { meetingMessageCrud } from '@/shared/modules/meetings/messages/dal/server/crud'

export const meetingMessageService = {
  ...meetingMessageCrud,
} as const

export type MeetingMessageService = typeof meetingMessageService
