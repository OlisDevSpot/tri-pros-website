import type { SceneTargets } from '@/features/trade-scenes/types'

// The FTC R-value Rule governs a savings claim made about insulation, so its wording joins a figure once insulation is drawn new.
export function installsInsulation(assemblies: SceneTargets['assemblies']): boolean {
  return Object.values(assemblies).some(target => target?.parts.some(part => part.role === 'insulate' && part.condition === 'installed') ?? false)
}
