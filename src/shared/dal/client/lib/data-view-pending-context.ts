'use client'

import { createContext } from 'react'

/**
 * True inside a `DataViewBoundary`'s fallback. There, data-view hooks return the view with no rows instead of
 * suspending, so the loading state is the real view (toolbar, table skeleton rows, calendar skeletons) and lines up
 * with it by construction.
 */
export const DataViewPendingContext = createContext(false)
