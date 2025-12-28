import type { InsertBenefit } from '@/db/schema'
import type { BenefitCategoryAccessor } from '@/db/types'

export const benefitsData = {
  reduceBills: [
    {
      accessor: 'waterBill',
      content: 'Reduce water bills',
      lucideIcon: 'Droplet',
    },
    {
      accessor: 'gasBill',
      content: 'Reduce gas bills',
      lucideIcon: 'Flame',
    },
    {
      accessor: 'electricBill',
      content: 'Reduce electric bills',
      lucideIcon: 'ZapOff',
    },
    {
      accessor: 'gardeningBill',
      content: 'Reduce gardening costs',
    },
    {
      accessor: 'reduceMaintenance',
      content: 'Reduces property maintenance',
    },
  ],
  increaseValue: [
    {
      accessor: 'increasePropertyValue',
      content: 'Increase property value',
      lucideIcon: 'PiggyBank',
    },
    {
      accessor: 'homeAppeal',
      content: 'Enhances home appeal',
    },
    {
      accessor: 'functionality',
      content: 'Adds functionality to home',
    },
    {
      accessor: 'homeSecurity',
      content: 'Improve home security',
      lucideIcon: 'ShieldCheck',
    },
    {
      accessor: 'fireResistance',
      content: 'Increase home fire resistance',
      lucideIcon: 'FireExtinguisher',
    },
  ],
  reduceHeadache: [
    {
      accessor: 'hvacLife',
      content: 'Increase HVAC lifespan',
      lucideIcon: 'AirVent',
    },
    {
      accessor: 'leakMoldPrevention',
      content: 'Leak & mold prevention',
      lucideIcon: 'Shrub',
    },
    {
      accessor: 'plumbingLife',
      content: 'Extend the life of plumbing systems',
    },
  ],
  increaseComfort: [
    {
      accessor: 'airQuality',
      content: 'Improve indoor air quality',
      lucideIcon: 'Wind',
    },
    {
      accessor: 'noiseReduction',
      content: 'Block more outside noise',
      lucideIcon: 'EarOff',
    },
  ],
  receiveIncentives: [
    {
      accessor: 'taxCredits',
      content: 'Available tax credits',
      lucideIcon: 'HandCoins',
    },
    {
      accessor: 'assistancePrograms',
      content: 'Offered through assistance programs',
      lucideIcon: 'BanknoteIcon',
    },
    {
      accessor: 'rebates',
      content: 'Qualifies for energy-efficient rebates',
      lucideIcon: 'CircleDollarSign',
    },
    {
      accessor: 'financing',
      content: 'Eligible for home improvement financing',
      lucideIcon: 'Landmark',
    },
    {
      accessor: 'taxDeductible',
      content: 'Payments may be tax deductible',
      lucideIcon: 'ChevronsDown',
    },
  ],
} as const satisfies Record<BenefitCategoryAccessor, Omit<InsertBenefit, 'categoryId'>[]>
