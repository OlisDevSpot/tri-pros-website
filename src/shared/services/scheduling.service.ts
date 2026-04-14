/** Follow-up reminders, meeting reminders (QStash delay/schedule) */
function createSchedulingService() {
  return {
    scheduleFollowUp: async (_params: { proposalId: string, delayMs: number }): Promise<void> => {
      throw new Error('schedulingService.scheduleFollowUp not implemented')
    },

    scheduleMeetingReminder: async (_params: { meetingId: string, reminderAt: string }): Promise<void> => {
      throw new Error('schedulingService.scheduleMeetingReminder not implemented')
    },

    cancelScheduled: async (_params: { jobId: string }): Promise<void> => {
      throw new Error('schedulingService.cancelScheduled not implemented')
    },
  }
}

export type SchedulingService = ReturnType<typeof createSchedulingService>
export const schedulingService = createSchedulingService()
