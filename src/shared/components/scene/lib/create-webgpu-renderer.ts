import type { WebGPURenderer } from 'three/webgpu'

// Loaded only when the look-dev page asks for WebGPU, so the WebGL path never downloads it.
export async function createWebGpuRenderer(props: { canvas: HTMLCanvasElement | OffscreenCanvas }): Promise<WebGPURenderer> {
  const { WebGPURenderer: Renderer } = await import('three/webgpu')
  const renderer = new Renderer({ canvas: props.canvas as HTMLCanvasElement, antialias: true })
  await renderer.init()
  return renderer
}
