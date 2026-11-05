// Called in the same frame as the pass that drew `source`: a WebGL canvas without a preserved drawing buffer may be cleared
// once the browser composites it.
export function copyBlueprintLines(target: HTMLCanvasElement, source: HTMLCanvasElement): boolean {
  // Assigning a size reallocates the backing store, which would happen every frame of a mid-handover camera move.
  if (target.width !== source.width || target.height !== source.height) {
    target.width = source.width
    target.height = source.height
  }
  const context = target.getContext('2d')
  if (!context) {
    return false
  }
  context.globalCompositeOperation = 'source-over'
  context.clearRect(0, 0, target.width, target.height)
  context.drawImage(source, 0, 0)
  // The pass draws white; the ink is a token, so the lines follow it without a shader change.
  context.globalCompositeOperation = 'source-in'
  context.fillStyle = getComputedStyle(target).getPropertyValue('--blueprint-ink').trim()
  context.fillRect(0, 0, target.width, target.height)
  context.globalCompositeOperation = 'source-over'
  return true
}
