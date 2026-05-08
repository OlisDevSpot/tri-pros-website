'use client'

import { useEffect } from 'react'

import { FILTER_SHORTCUT_KEY, SEARCH_SHORTCUT_KEY } from '@/shared/components/query-toolbar/constants/keyboard-hints'

interface UseToolbarShortcutsArgs {
  /** Ref to the search input. Pressing `/` focuses it. */
  searchInputRef: React.RefObject<HTMLInputElement | null>
  /** Callback to open the filter trigger. Pressing `F` invokes it. */
  onOpenFilter: () => void
  /** Callback for `←` (left-arrow) — typically pagination prev. No-op when undefined. */
  onPrevPage?: () => void
  /** Callback for `→` (right-arrow) — typically pagination next. No-op when undefined. */
  onNextPage?: () => void
}

/**
 * Wires keyboard shortcuts at the document level for the records page:
 *   `/`  → focus search
 *   `F`  → open filter trigger
 *   `←`  → previous page (when `onPrevPage` provided)
 *   `→`  → next page (when `onNextPage` provided)
 *
 * Skips when the user is already typing in an input/textarea/CE so
 * shortcuts don't hijack ordinary text entry. Modifier-key combos are
 * ignored too — `Cmd+/` and `Cmd+←` belong to the OS/browser.
 *
 * Lives in `query-toolbar/hooks/` because the file's primary export is a
 * hook (per project rule: hook files in `hooks/`, context bundles in `lib/`).
 */
export function useToolbarShortcuts({
  searchInputRef,
  onOpenFilter,
  onPrevPage,
  onNextPage,
}: UseToolbarShortcutsArgs) {
  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) {
        return false
      }
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return true
      }
      if (target.isContentEditable) {
        return true
      }
      return false
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }
      if (isTypingTarget(event.target)) {
        return
      }
      if (event.key === SEARCH_SHORTCUT_KEY) {
        event.preventDefault()
        searchInputRef.current?.focus()
        return
      }
      if (event.key.toLowerCase() === FILTER_SHORTCUT_KEY) {
        event.preventDefault()
        onOpenFilter()
        return
      }
      if (event.key === 'ArrowLeft' && onPrevPage) {
        event.preventDefault()
        onPrevPage()
        return
      }
      if (event.key === 'ArrowRight' && onNextPage) {
        event.preventDefault()
        onNextPage()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [searchInputRef, onOpenFilter, onPrevPage, onNextPage])
}
