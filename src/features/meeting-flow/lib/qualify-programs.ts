import type { QualificationContext, QualificationResult } from '@/features/meeting-flow/types'
import { MEETING_PROGRAMS } from '@/features/meeting-flow/constants/programs'

export interface ProgramQualification {
  accessor: string
  name: string
  accentColor: 'amber' | 'sky' | 'violet'
  result: QualificationResult
}

export function qualifyAllPrograms(ctx: QualificationContext): ProgramQualification[] {
  return MEETING_PROGRAMS.map(program => ({
    accessor: program.accessor,
    name: program.name,
    accentColor: program.accentColor,
    result: program.qualify(ctx),
  }))
}
