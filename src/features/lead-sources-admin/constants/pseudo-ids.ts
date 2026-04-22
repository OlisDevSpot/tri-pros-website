/**
 * The literal value used in the `?id=` URL param + selection state to mean
 * "show the aggregate view across every lead source". Distinct from every
 * real uuid so `selectedId === ALL_PSEUDO_ID` is a safe type-check boundary
 * between the AllDetail pane and a SourceDetail pane.
 */
export const ALL_PSEUDO_ID = 'all'
