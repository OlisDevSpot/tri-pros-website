import { AC_TON_LABELS, AGE_GROUP_LABELS, CRAWL_INSULATION_LABELS, DUCT_LABELS, EXTERIOR_PAINT_LABELS, FOUNDATION_TYPE_LABELS, GUTTER_LABELS, HOUSEHOLD_TYPE_LABELS, HVAC_COMPONENT_LABELS, HVAC_TYPE_LABELS, INSULATION_LEVEL_LABELS, PROFILE_COPY, WINDOWS_TYPE_LABELS, YEAR_BUILT_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { withUnknown } from '@/features/trade-scenes/lib/profile-choice'
import { customerAgeGroups, householdTypes, yearBuiltRanges } from '@/shared/constants/enums/customers'
import { acTonnages, crawlInsulations, ductMaterials, exteriorPaints, foundationTypes, gutterOptions, hvacComponents, hvacTypes, insulationLevels, windowsTypes } from '@/shared/modules/construction/core/constants/enums'

// Every field may be off the record, so each offers "Not sure": the home then draws its typical fallback.
export const HOME_PROFILE_CHOICES = {
  yearBuilt: withUnknown(yearBuiltRanges, YEAR_BUILT_LABELS, PROFILE_COPY.unknown),
  insulationLevel: withUnknown(insulationLevels, INSULATION_LEVEL_LABELS, PROFILE_COPY.unknown),
  foundationType: withUnknown(foundationTypes, FOUNDATION_TYPE_LABELS, PROFILE_COPY.unknown),
  hvacType: withUnknown(hvacTypes, HVAC_TYPE_LABELS, PROFILE_COPY.unknown),
  hvacComponents: withUnknown(hvacComponents, HVAC_COMPONENT_LABELS, PROFILE_COPY.unknown),
  windowsType: withUnknown(windowsTypes, WINDOWS_TYPE_LABELS, PROFILE_COPY.unknown),
  gutters: withUnknown(gutterOptions, GUTTER_LABELS, PROFILE_COPY.unknown),
  exteriorPaint: withUnknown(exteriorPaints, EXTERIOR_PAINT_LABELS, PROFILE_COPY.unknown),
  ducts: withUnknown(ductMaterials, DUCT_LABELS, PROFILE_COPY.unknown),
  crawlInsulation: withUnknown(crawlInsulations, CRAWL_INSULATION_LABELS, PROFILE_COPY.unknown),
  acTons: withUnknown(acTonnages, AC_TON_LABELS, PROFILE_COPY.unknown),
  householdType: withUnknown(householdTypes, HOUSEHOLD_TYPE_LABELS, PROFILE_COPY.unknown),
  ageGroup: withUnknown(customerAgeGroups, AGE_GROUP_LABELS, PROFILE_COPY.unknown),
} as const
