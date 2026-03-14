import type { LucideIcon } from 'lucide-react'
import type { IconType } from 'react-icons/lib'
import type { Proposal } from '@/shared/db/schema'
import {
  BanknoteArrowDownIcon,
  CircleUserIcon,
  DrillIcon,
  MailIcon,
  MapPinHouseIcon,
  PhoneIcon,
} from 'lucide-react'
import { FaTimeline } from 'react-icons/fa6'
import { projectTypes } from '@/shared/constants/enums'
import { formatAddress } from '@/shared/lib/formatters'

export type Display = string | React.ReactNode

export type ProposalOverviewContext
  = & {
    name: string
    email: string | null
    phone: string | null
    address: string | null
    city: string
    state: string | null
    zip: string
  }
  & Proposal['projectJSON']['data']
  & Proposal['fundingJSON']['data']
  & { scopes: string, exclusiveOffers: string }

export interface BaseField {
  label: string
  name: keyof ProposalOverviewContext | string
  Icon?: LucideIcon | IconType
}

interface TextField extends BaseField {
  type?: 'text'
  format?: (value: string, ctx: ProposalOverviewContext) => Display
}

interface EnumField<T extends string> extends BaseField {
  type: 'enum'
  values: readonly T[]
  format?: (value: T, ctx: ProposalOverviewContext) => Display
}

interface NumberField extends BaseField {
  type: 'number'
  format: (value: number, ctx: ProposalOverviewContext) => Display
}

type Field<E extends string = string> = BaseField | NumberField | TextField | EnumField<E>

export type FieldWithValues<F extends Field = Field> = F & {
  rawValue?: unknown
  displayValue: Display
}

interface Section {
  label: string
  fields: Field[]
}

export const proposalFields = [
  {
    label: 'Customer',
    fields: [
      {
        type: 'text',
        label: 'Name',
        name: 'name',
        Icon: CircleUserIcon,
      },
      {
        type: 'text',
        label: 'Address',
        name: 'address',
        Icon: MapPinHouseIcon,
        format: (_value, ctx) => {
          const { address, city, state, zip } = ctx
          if (!address) {
            return '—'
          }
          return (
            <div className="whitespace-pre-line">
              {formatAddress(address, city, state ?? 'CA', zip)}
            </div>
          )
        },
      },
      {
        type: 'text',
        label: 'Email',
        name: 'email',
        Icon: MailIcon,
      },
      {
        type: 'text',
        label: 'Phone',
        name: 'phone',
        Icon: PhoneIcon,
      },
    ],
  },
  {
    label: 'Project',
    fields: [
      {
        label: 'Project Type',
        name: 'type',
        type: 'enum',
        values: projectTypes,
        format: (value) => {
          if (value === 'general-remodeling') {
            return 'General Remodeling'
          }

          if (value === 'energy-efficient') {
            return 'Energy Efficient'
          }

          return ''
        },
        Icon: DrillIcon,
      },
      {
        label: 'Time Allocated',
        name: 'timeAllocated',
        Icon: FaTimeline,
      },
      {
        label: 'Scopes',
        name: 'scopes',
        type: 'text',
        Icon: BanknoteArrowDownIcon,
        format: (value) => {
          const scopes = value.split(',')
          return (
            <div className="flex flex-col gap-2">
              <span className="flex flex-col gap-2">
                {scopes.map(scope => (
                  <span key={scope}>{scope}</span>
                ))}
              </span>
            </div>
          )
        },
      },
    ],
  },
] as const satisfies Section[]
