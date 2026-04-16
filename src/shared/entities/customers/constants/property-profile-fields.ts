import type { ProfileFieldConfig } from '@/shared/entities/customers/types'

import { yearBuiltRanges } from '@/shared/constants/enums/customers'
import {
  foundationTypes,
  hvacComponents,
  hvacTypes,
  insulationLevels,
  roofTypes,
  windowsTypes,
} from '@/shared/domains/construction/constants/enums'

export const PROPERTY_PROFILE_FIELDS: ProfileFieldConfig[] = [
  { id: 'yearBuilt', label: 'Year Built', type: 'select', options: yearBuiltRanges },
  { id: 'hoa', label: 'HOA', type: 'boolean' },
  { id: 'roofType', label: 'Roof Type', type: 'select', options: roofTypes },
  { id: 'foundationType', label: 'Foundation Type', type: 'select', options: foundationTypes },
  { id: 'hvacType', label: 'HVAC Type', type: 'select', options: hvacTypes },
  { id: 'hvacComponents', label: 'HVAC Components', type: 'select', options: hvacComponents },
  { id: 'windowsType', label: 'Windows Type', type: 'select', options: windowsTypes },
  { id: 'insulationLevel', label: 'Insulation Level', type: 'select', options: insulationLevels },
]
