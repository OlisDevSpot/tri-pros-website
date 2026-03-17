export type ProgramAccessor = 'tpr-monthly-special' | 'energy-savings-plus' | 'senior-citizen-program'

export type BuyTriggerType = 'urgency' | 'scarcity' | 'authority' | 'risk-reduction' | 'social-proof'

export interface BuyTrigger {
  type: BuyTriggerType
  message: string
}

export interface CaseStudy {
  afterImg?: string
  beforeImg?: string
  context: string
  location: string
  name: string
  quote?: string
  results: string[]
}

export type CollectionFieldType = 'select' | 'text' | 'number' | 'rating' | 'boolean'

import type { JsonbSection } from '@/shared/types/jsonb'

export type { JsonbSection } from '@/shared/types/jsonb'

export interface CollectionField {
  entity: 'customer' | 'meeting'
  id: string
  jsonbKey: JsonbSection
  label: string
  max?: number
  min?: number
  options?: readonly string[]
  placeholder?: string
  required?: boolean
  type: CollectionFieldType
}

export interface IntakeStep {
  description: string
  fields: CollectionField[]
  id: string
  title: string
}

import type { Customer } from '@/shared/db/schema'

export interface MeetingContext {
  collectedData: {
    bill: string
    dmsPresent: string
    scope: string
    timeline: string
    triggerEvent: string
    yrs: string
  }
  customer: Pick<Customer, 'id' | 'name' | 'address' | 'city' | 'email' | 'phone' | 'state'> | null
}

export interface MeetingStep {
  body: string
  bodyFn?: (ctx: MeetingContext) => string
  buyTrigger: BuyTrigger
  caseStudy: CaseStudy
  collectsData?: CollectionField[]
  headline: string
  headlineFn?: (ctx: MeetingContext) => string
  accessor: string
  shortLabel?: string
  title: string
}

export interface MeetingProgram {
  accentColor: 'amber' | 'sky' | 'violet'
  forWho: string
  accessor: string
  name: string
  signals: string[]
  steps: MeetingStep[]
  tagline: string
}
