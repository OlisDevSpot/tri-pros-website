import { z } from 'zod'

import { BILL_CATEGORIES } from '@/shared/modules/construction/core/constants/bill-categories'
import { BILL_CUT_ADD_ON_IDS } from '@/shared/modules/construction/core/constants/bill-cut-add-ons'
import { tradeSlugs } from '@/shared/modules/construction/core/constants/trade-slugs'

const sharePercent = z.number().min(0).max(100)
const categoryCuts = z.partialRecord(z.enum(BILL_CATEGORIES), sharePercent)

export const tradeBillCutsSchema = z.partialRecord(z.enum(tradeSlugs), z.object({
  base: categoryCuts,
  addOns: z.partialRecord(z.enum(BILL_CUT_ADD_ON_IDS), categoryCuts).optional(),
}))

export type TradeBillCuts = z.infer<typeof tradeBillCutsSchema>
