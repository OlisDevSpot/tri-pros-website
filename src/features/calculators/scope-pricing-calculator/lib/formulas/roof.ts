import { defineFormula } from '@/features/calculators/scope-pricing-calculator/lib/define-formula'

export const overlay = defineFormula({
  key: 'overlay',
  trade: 'roof',
  label: 'Roof Overlay',
  outcome: 'Add a fresh, protective roofing layer that extends lifespan without a full tear-off',
  variables: ['numFlatBSQ', 'numPitchedBSQ'],
  compute({ numFlatBSQ, numPitchedBSQ }, context, costs) {
    const totalBSQ = numFlatBSQ + numPitchedBSQ
    const additionalStories = (context.numStories - 1) * costs.dollarPerAdditionalStory * totalBSQ
    return numFlatBSQ * costs.BSQOverlayFlat + numPitchedBSQ * costs.BSQOverlayPitched + additionalStories
  },
})

export const tearOff = defineFormula({
  key: 'tearOff',
  trade: 'roof',
  label: 'Roof Tear-off',
  outcome: 'Replace your entire roof for maximum durability, energy performance, and weather protection',
  variables: ['numFlatBSQ', 'numPitchedBSQ', 'numLayers'],
  compute({ numFlatBSQ, numPitchedBSQ, numLayers }, context, costs) {
    const totalBSQ = numFlatBSQ + numPitchedBSQ
    const pitchedRate = context.currentRoofType === 'shingle' ? costs.BSQTearOffShingles : costs.BSQTearOffTile
    const additionalLayers = (numLayers - 1) * costs.dollarPerAdditionalLayer * numPitchedBSQ
    const additionalStories = (context.numStories - 1) * costs.dollarPerAdditionalStory * totalBSQ
    return numPitchedBSQ * pitchedRate + numFlatBSQ * costs.BSQTearOffFlat + additionalLayers + additionalStories
  },
})

export const redeck = defineFormula({
  key: 'redeck',
  trade: 'roof',
  label: 'Roof Redeck',
  outcome: 'Replace the entire roof deck and finish to restore structural integrity and upgrade long-term performance',
  variables: ['numFlatBSQ', 'numPitchedBSQ', 'numLayers'],
  compute({ numFlatBSQ, numPitchedBSQ, numLayers }, context, costs) {
    const totalBSQ = numFlatBSQ + numPitchedBSQ
    const base = numFlatBSQ * costs.BSQRedeckFlat + numPitchedBSQ * costs.BSQRedeckPitched
    const additionalLayers = (numLayers - 1) * costs.dollarPerAdditionalLayer * numPitchedBSQ
    const additionalStories = (context.numStories - 1) * costs.dollarPerAdditionalStory * totalBSQ
    return base + additionalLayers + additionalStories
  },
})

export const tileReset = defineFormula({
  key: 'tileReset',
  trade: 'roof',
  label: 'Tile Reset',
  outcome: 'Reinstall your tile roof with upgraded underlayment for improved longevity and leak protection',
  variables: ['numPitchedBSQ'],
  compute({ numPitchedBSQ }, context, costs) {
    const additionalStoriesRate = (context.numStories - 1) * costs.dollarPerAdditionalStory
    return numPitchedBSQ * (costs.BSQTileReset + additionalStoriesRate)
  },
})
