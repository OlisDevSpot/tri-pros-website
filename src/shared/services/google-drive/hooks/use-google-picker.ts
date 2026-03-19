'use client'

import { useCallback, useRef, useState } from 'react'
import type { PickedFile } from '../types'

interface UseGooglePickerOptions {
  onFilesPicked: (files: PickedFile[]) => void
}

interface UseGooglePickerReturn {
  isLoading: boolean
  openPicker: (accessToken: string) => void
}

function loadGapiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Cannot load gapi outside browser'))
      return
    }
    if (window.gapi) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://apis.google.com/js/api.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google API script'))
    document.head.appendChild(script)
  })
}

export function useGooglePicker({ onFilesPicked }: UseGooglePickerOptions): UseGooglePickerReturn {
  const [isLoading, setIsLoading] = useState(false)
  const onFilesPickedRef = useRef(onFilesPicked)
  onFilesPickedRef.current = onFilesPicked

  const openPicker = useCallback((accessToken: string) => {
    setIsLoading(true)

    loadGapiScript()
      .then(() => {
        window.gapi.load('picker', () => {
          setIsLoading(false)

          const view = new google.picker.DocsView()
            .setMimeTypes('image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif')
            .setIncludeFolders(false)

          new google.picker.PickerBuilder()
            .setOAuthToken(accessToken)
            .addView(view)
            .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
            .setCallback((data: google.picker.PickerResponse) => {
              if (data.action !== google.picker.Action.PICKED)
                return
              const files: PickedFile[] = data.docs.map(d => ({
                id: d.id,
                mimeType: d.mimeType,
                name: d.name,
              }))
              onFilesPickedRef.current(files)
            })
            .build()
            .setVisible(true)
        })
      })
      .catch(() => {
        setIsLoading(false)
      })
  }, [])

  return { isLoading, openPicker }
}
