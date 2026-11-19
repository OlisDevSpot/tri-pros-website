export interface TextureBinding {
  shown: string | null
  wanted: string
}

// The shown maps stay bound until every wanted one has arrived, so a pick never flashes flat colour; a pick that comes back
// to the shown maps before the new ones arrive changes nothing.
export function nextTextureBinding(state: TextureBinding, wanted: string, wantedReady: boolean): { state: TextureBinding, release: string | null } {
  if (!wantedReady || state.shown === wanted) {
    return { state: { shown: state.shown, wanted }, release: null }
  }
  return { state: { shown: wanted, wanted }, release: state.shown }
}
