export const SCOPE_IDS = {
  roofOverlay: '32f0ca1b-548b-804e-9fa1-f5009c68668e',
  roofTorchDown: '31a0ca1b-548b-8013-9ad6-fbb929ef9b06',
  roofTearOff: 'bd60ca1b-548b-821d-bd96-011624aa0fbb',
  roofRedeck: 'a2c0ca1b-548b-8296-a58d-01b88fb83405',
  roofTileReset: '90d0ca1b-548b-82da-96b5-81a9f501bcce',
  gutters: '0e90ca1b-548b-8388-8bae-81bd2bb61e4b',
  airSealing: '32f0ca1b-548b-80da-a907-ee6613d8d94e',
  atticInsulationReplacement: 'a5f0ca1b-548b-838a-89da-8134c5bfc738',
  atticInsulationTopOff: '6d70ca1b-548b-835e-a8be-017c9038ac42',
  radiantBarrier: 'c050ca1b-548b-825d-b707-01aff56ca25d',
  atticFan: 'e050ca1b-548b-8263-8634-01293821c390',
  windowReplacement: '3e40ca1b-548b-824d-b0db-81cc10787e73',
  coolLifeRepaint: '9d60ca1b-548b-824a-8aef-81f1e29b9b34',
  waterBasedRepaint: '4020ca1b-548b-82d2-96c2-81068068e903',
  splitSystemReplacement: '6450ca1b-548b-830a-ac5e-018e7fd3064a',
  packageUnitReplacement: '9460ca1b-548b-8375-8d63-814dddf36b71',
  airDuctsReplacement: 'bc50ca1b-548b-8366-9ef9-811c2f36877f',
  crawlSpaceInsulation: '02f0ca1b-548b-82e6-8fa5-8118eff44429',
} as const

export type ScopeId = (typeof SCOPE_IDS)[keyof typeof SCOPE_IDS]
