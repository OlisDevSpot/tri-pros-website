import type { SceneChangeSlot } from '@/features/trade-scenes/types'

import { CONTROLS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { SCENE_CHANGE_RESULTS_MAX } from '@/features/trade-scenes/constants/scene-change-words'

function wordsOf(text: string): string[] {
  return text.toLowerCase().split(/\s+/).filter(Boolean)
}

function prefixesAWord(token: string, text: string): boolean {
  return wordsOf(text).some(word => word.startsWith(token))
}

// Every token must start a word of the slot's name, its group tag, its words or one of its values. The Enter target is
// the one value every value-naming token starts a word of, so "tile metal" names none and "wood shake" names Wood shake.
// A condition word ("worn") lists every Condition slot, as their values are the condition words. A value a token spells
// out whole outranks one it only starts, so "4" finds 4 ton before 45–65.
export function searchSceneChanges(slots: readonly SceneChangeSlot[], query: string): { slot: SceneChangeSlot, hit: string | null }[] {
  const tokens = wordsOf(query)
  if (tokens.length === 0) {
    return []
  }
  const phrase = tokens.join(' ')
  return slots
    .flatMap((slot, order) => {
      const text = `${slot.name} ${CONTROLS_COPY.modify.groupTags[slot.group]} ${slot.words}`
      let candidates: SceneChangeSlot['options'] | null = null
      const valueTokens: string[] = []
      for (const token of tokens) {
        const values = slot.options.filter(option => prefixesAWord(token, option.label))
        if (values.length === 0) {
          if (!prefixesAWord(token, text)) {
            return []
          }
          continue
        }
        valueTokens.push(token)
        candidates = (candidates ?? values).filter(option => values.includes(option))
      }
      const value = candidates?.length === 1 ? candidates[0] : null
      const hit = value && { value: value.value, whole: valueTokens.some(token => wordsOf(value.label).includes(token)) }
      const rank = wordsOf(slot.name).join(' ') === phrase ? 0 : hit === null ? 3 : hit.whole ? 1 : 2
      return [{ slot, hit: hit === null ? null : hit.value, rank, order }]
    })
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .slice(0, SCENE_CHANGE_RESULTS_MAX)
    .map(({ slot, hit }) => ({ slot, hit }))
}
