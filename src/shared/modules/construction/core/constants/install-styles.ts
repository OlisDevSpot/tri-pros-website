// A style changes how an install looks, never how well it insulates, so it never moves a saving.
export const INSTALL_STYLE_IDS = ['batts'] as const
export type InstallStyleId = typeof INSTALL_STYLE_IDS[number]
