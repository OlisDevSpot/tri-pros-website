import type { SceneShortcutKey } from '@/features/trade-scenes/constants/scene-shortcuts'

import { SHORTCUT_COPY } from '@/features/trade-scenes/constants/home-scene-copy'

// A named key reads by its short name on a cap; every other key is the character it types.
export function keycapLabel(key: SceneShortcutKey): string {
  return (SHORTCUT_COPY.keyNames as Partial<Record<SceneShortcutKey, string>>)[key] ?? key.toUpperCase()
}
