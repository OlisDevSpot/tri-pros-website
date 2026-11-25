import type { CompressedTexture, WebGLRenderer } from 'three'
import type { StoreTimers, TextureStore } from '@/features/trade-scenes/ui/lib/texture-store'

import { FileLoader, RepeatWrapping } from 'three'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'

import { readyLoader } from '@/features/trade-scenes/ui/lib/ready-loader'
import { createTextureStore, MissingTextureError } from '@/features/trade-scenes/ui/lib/texture-store'

const TRANSCODER_PATH = '/scenes/basis/'
const LINGER_MS = 5000
const RETRY_DELAYS_MS = [2000, 8000, 30000]
const MAX_ANISOTROPY = 8

interface TextureStoreWiring {
  whenBack: (retry: () => void) => () => void
  timers?: StoreTimers
}

function createLoader(gl: WebGLRenderer): KTX2Loader {
  const loader = new KTX2Loader().setTranscoderPath(TRANSCODER_PATH).setWorkerLimit(2).detectSupport(gl)
  // Where ETC2 or ASTC is there, BC7 is not taken even when offered: ETC1S lands in ETC2 at half BC7's memory, so a desktop
  // is held to the iPad's budget.
  if (loader.workerConfig.etc2Supported || loader.workerConfig.astcSupported) {
    loader.workerConfig.bptcSupported = false
  }
  return loader
}

// three's FileLoader rejects any answer but a 200 with an error that carries the response.
function isMissing(error: unknown): boolean {
  const status = (error as { response?: { status?: unknown } } | null)?.response?.status
  return typeof status === 'number' && status >= 400 && status < 500
}

// A store for one renderer, since a texture uploaded to one GL context cannot be bound in another. Its creator disposes it,
// which ends the transcoder's workers, cancels its downloads and frees every map.
export function textureStoreFor(gl: WebGLRenderer, { whenBack, timers }: TextureStoreWiring): TextureStore {
  const transcoder = readyLoader(() => createLoader(gl))
  // The file is fetched here rather than through KTX2Loader.load, so a download landing after dispose never reaches the
  // loader: its worker pool would start a fresh worker for it that nothing would ever end.
  const files = new FileLoader().setResponseType('arraybuffer')
  const anisotropy = Math.min(MAX_ANISOTROPY, gl.capabilities.getMaxAnisotropy())
  let disposed = false
  const store = createTextureStore(async ({ url, tileMetres }) => {
    const loader = await transcoder.get()
    let buffer: ArrayBuffer
    try {
      buffer = await files.loadAsync(url) as ArrayBuffer
    }
    catch (error) {
      throw isMissing(error) ? new MissingTextureError(url, { cause: error }) : error
    }
    if (disposed) {
      throw new Error(`${url} arrived after its store was disposed`)
    }
    const texture = await new Promise<CompressedTexture>((resolve, reject) => loader.parse(buffer, resolve, reject))
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.repeat.set(1 / tileMetres, 1 / tileMetres)
    texture.anisotropy = anisotropy
    return texture
  }, { lingerMs: LINGER_MS, retryDelaysMs: RETRY_DELAYS_MS, whenBack, timers })
  return {
    ...store,
    dispose() {
      disposed = true
      store.dispose()
      files.abort()
      transcoder.dispose()
    },
  }
}
