export const TRADE_SELECTION_COPY = {
  noWork: 'No work yet',
  noReason: 'No reason yet',
  workSummary: (first: string, more: number) => `${first} +${more}`,
  notePrefix: 'Note · ',
} as const
