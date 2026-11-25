import type { FormPartId } from '@/features/proposal-flow/constants/form-parts'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useFormPart } from '@/features/proposal-flow/hooks/use-form-part'

// A part opened from the phone list pushes an entry, so the back gesture returns to the list instead of leaving
// the page. Back pops that entry; with nothing pushed (a deep link, an error jump) it clears the param in
// place, because popping would leave the page.
export function usePartListNavigation() {
  const router = useRouter()
  const { part, setPart } = useFormPart()
  const pushedFromList = useRef(false)

  useEffect(() => {
    if (part === null) {
      pushedFromList.current = false
    }
  }, [part])

  function openFromList(id: FormPartId) {
    pushedFromList.current = true
    void setPart(id, { history: 'push' })
  }

  function backToList() {
    if (pushedFromList.current) {
      pushedFromList.current = false
      router.back()
      return
    }
    void setPart(null)
  }

  return { openFromList, backToList }
}
