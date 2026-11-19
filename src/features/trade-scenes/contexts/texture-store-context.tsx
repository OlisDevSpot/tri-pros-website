'use client'

import type { ReactNode } from 'react'
import type { TextureStore } from '@/features/trade-scenes/ui/lib/texture-store'

import { useThree } from '@react-three/fiber'
import { createContext, use, useEffect, useState } from 'react'

import { textureStoreFor } from '@/features/trade-scenes/ui/lib/texture-store-for'

// Undefined outside a provider; null for the first commit, before the provider's effect has made its store.
const TextureStoreContext = createContext<TextureStore | null | undefined>(undefined)

// A flaky connection rarely fires `online`; coming back to the app is the other moment worth trying again. Only while the
// app is in front, so a reconnect in the background waits for the rep to return.
function whenBack(retry: () => void): () => void {
  const stop = () => {
    window.removeEventListener('online', back)
    document.removeEventListener('visibilitychange', back)
  }
  function back() {
    if (document.visibilityState !== 'visible') {
      return
    }
    stop()
    retry()
  }
  window.addEventListener('online', back)
  document.addEventListener('visibilitychange', back)
  return stop
}

interface TextureStoreProviderProps {
  children: ReactNode
}

// The scene's textures live as long as its 3D content: each visit starts its own transcoder (its files come from the browser
// cache), and leaving ends its workers and frees every map.
export function TextureStoreProvider({ children }: TextureStoreProviderProps) {
  const gl = useThree(state => state.gl)
  // Made in the effect, not in render: StrictMode runs the cleanup and then the effect again, and a store made once in render
  // would be handed out after that cleanup had disposed it.
  const [store, setStore] = useState<TextureStore | null>(null)
  useEffect(() => {
    const own = textureStoreFor(gl, { whenBack })
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- published from here for the reason above
    setStore(own)
    return () => own.dispose()
  }, [gl])
  return <TextureStoreContext value={store}>{children}</TextureStoreContext>
}

export function useTextureStore(): TextureStore | null {
  const store = use(TextureStoreContext)
  if (store === undefined) {
    throw new Error('useTextureStore must be used inside a TextureStoreProvider')
  }
  return store
}
