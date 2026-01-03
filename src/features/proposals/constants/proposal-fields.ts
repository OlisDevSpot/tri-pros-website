import type { LucideIcon } from 'lucide-react'
import type { IconType } from 'react-icons/lib'
import {
  BabyIcon,
  BanknoteArrowDownIcon,
  CircleDollarSignIcon,
  CircleUserIcon,
  DrillIcon,
  MailIcon,
  MapPinHouseIcon,
  PhoneIcon,
} from 'lucide-react'
import { FaTimeline } from 'react-icons/fa6'
import { projectTypes } from '@/shared/constants/enums'

interface BaseField {
  label: string
  name: string
  Icon?: LucideIcon | IconType
}

interface TextField extends BaseField {
  type: 'text'
  value?: string
  format?: (value: string) => string
}

interface EnumField<T extends string> extends BaseField {
  type: 'enum'
  values: readonly T[]
  value?: T
  format?: (value: T) => string
}

interface NumberField extends BaseField {
  type: 'number'
  value?: number
  format: (value: number) => string
}

type Field<E extends string = string> = BaseField | NumberField | TextField | EnumField<E>

interface Section {
  label: string
  overviewFields: Field[]
  extraFields: Field[]
}

export const proposalFields = [
  {
    label: 'Homeowner',
    overviewFields: [
      {
        label: 'Name',
        name: 'name',
        Icon: CircleUserIcon,
      },
      {
        label: 'Email',
        name: 'email',
        Icon: MailIcon,
      },
      {
        label: 'Phone',
        name: 'phone',
        Icon: PhoneIcon,
      },
      {
        type: 'number',
        label: 'Age',
        name: 'customerAge',
        Icon: BabyIcon,
        format: value => `${value} years old`,
      },
    ],
    extraFields: [
      {
        label: 'Full address',
        name: 'address',
        Icon: MapPinHouseIcon,
      },
    ],
  },
  {
    label: 'Project',
    overviewFields: [
      {
        label: 'Project Type',
        name: 'projectType',
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
        value: '{{project.timeAllocated}}',
        Icon: FaTimeline,
      },
    ],
    extraFields: [
      {
        label: 'Scope of Work Summary',
        name: 'scopeOfWorkSummary',
        value: '{{project.scopeOfWorkSummary}}',
      },
      {
        label: 'Approximate start date',
        name: 'approximateStartDate',
        value: '{{project.approximateStartDate}}',
      },
      {
        label: 'Approximate completion date',
        name: 'approximateCompletionDate',
        value: '{{project.approximateCompletionDate}}',
      },
    ],
  },
  {
    label: 'Funding',
    overviewFields: [
      {
        type: 'number',
        label: 'Total Contract Price',
        name: 'tcp',
        format: value => value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
        Icon: CircleDollarSignIcon,
      },
      {
        type: 'number',
        label: 'Deposit',
        name: 'depositAmount',
        format: value => value.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        }),
        Icon: BanknoteArrowDownIcon,
      },
    ],
    extraFields: [
      {
        label: 'Total Cash',
        name: 'totalCash',
        value: '{{funding.totalCash}}',
      },
      {
        label: 'Total Loan',
        name: 'totalLoan',
        value: '{{funding.totalLoan}}',
      },
      {
        label: 'Finance Company',
        name: 'financeCompany',
        value: '{{funding.financeCompany}}',
      },
      {
        label: 'Loan Term',
        name: 'loanTerm',
        value: '{{funding.loanTerm}}',
      },
      {
        label: 'Interest Rate',
        name: 'interestRate',
        value: '{{funding.interestRate}}',
      },
      {
        label: 'Discounts',
        name: 'discounts',
        value: '{{funding.discount[]}}',
      },
    ],
  },
] as const satisfies Section[]
