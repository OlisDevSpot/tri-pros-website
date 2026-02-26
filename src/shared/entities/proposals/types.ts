import type { HomeArea, ProjectType } from '@/shared/types/enums'

export interface SOW {
  title: string
  scopes: string[]
  trade: string
  html: string
}

export interface FormSection<T, ExtraFields = Record<string, unknown>> {
  data: T & ExtraFields
  meta: {
    enabled: boolean
  }
}

interface Homeowner {
  name: string
  phoneNum: string
  email: string
  age?: number
  notionPageId?: string
}

interface Project {
  address: string
  city: string
  state: 'CA'
  zip: string
  label: string
  type: ProjectType
  timeAllocated: string
  summary?: string
  energyBenefits?: string
  projectObjectives: string[]
  homeAreasUpgrades: HomeArea[]
  sow: SOW[]
  agreementNotes?: string
}

export interface Funding {
  tcp: number
  cashInDeal: number
  depositAmount: number
  incentives: {
    reason: string
    amount: number
  }[]
}

export interface HomeownerSection extends FormSection<Homeowner> {}
export interface ProjectSection extends FormSection<Project> {}
export interface FundingSection extends FormSection<Funding> {}
