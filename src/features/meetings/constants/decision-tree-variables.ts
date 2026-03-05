export const baseYesNoOpts = ['yes', 'no', 'N/A'] as const

export const dmsAgeGroupOpts = ['Young', 'Adult', 'Senior', 'Elder'] as const
export const dmsFamilyStatuses = ['Single man', 'Single woman', 'Couple', 'Family', 'Multi-family'] as const
export const dmsPresentStatuses = ['All', 'Only husband present', 'Only wife present', 'None present'] as const
export const timeInHomeOpts = ['< 3 years', '3-5 years', '5-10 years', '10-15 years', '> 15 years'] as const
export const timeHorizonForHomeOpts = ['< 3 years', '3-5 years', '5-10 years', '10-15 years', '> 15 years'] as const
export const decisionUrgencyStatuses = ['ASAP', '1-2 weeks', '1 month', '3+ months'] as const
export const planningToSellOpts = ['No', 'Yes', 'Soon', 'Not sure'] as const

export const yearBuilt = [
  'Pre-1950',
  '1950-1978',
  '1978-2014',
  'Post-2014',
] as const

export const painType = [
  'Has urgent fixes',
  'Home has physical damages',
  'High maintenance / utility costs',
  'Home has inefficiencies',
  'Very old home',
  'Had bad past experience',
  'Fearful of construction',
  'Doesn\'t trust themselves with decision',
  'Has financial / budget constraints',
  'Social (compeition / status / family)',
  'Home is not place of rest / comfort',
] as const

export const financialMotivations = [
  'Motivated by price / incentives',
  'Motivated by property value',
  'Motivated by lifestyle upgrades',
  'Motivated by future',
  'Motivated by next generation (inheritance)',
  'Motivated by social status',
  'Motivated by clean energy',
] as const

export const creditScoreRanges = ['< 600', '600-630', '630-650', '650-700', '700-749', '750-800', '> 800'] as const

export const decisionFlowCombos = {
  'senior-couple': '',
}

// TODO: need to tie each scope to motivation & pain points
// TODO: scope pairing & scope-addon pairing
// TODO: addon packages
