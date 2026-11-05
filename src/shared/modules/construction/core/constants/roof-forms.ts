export const ROOF_FORMS = ['pitched', 'low-slope'] as const
export type RoofForm = (typeof ROOF_FORMS)[number]
