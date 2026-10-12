'use client'

import { createContext } from 'react'

/**
 * `'loading'` inside a route's loading screen, a `DataViewBoundary`'s suspense fallback, the layout's document-load
 * skeleton and the PWA launch shell; `'error'` inside a `DataViewBoundary`'s error fallback. In either, data-view reads
 * never suspend, so the pending state is the real view and lines up with it by construction. Only `'loading'` shows
 * cached rows (`useLoadingScreenRead`): rows that failed to render must not render again inside their own fallback.
 */
export type DataViewPendingState = false | 'loading' | 'error'

export const DataViewPendingContext = createContext<DataViewPendingState>(false)
