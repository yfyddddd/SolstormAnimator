import type { Frame, Layer, Point, Stroke } from '../types'

const safeCrypto =
  typeof globalThis !== 'undefined' && 'crypto' in globalThis
    ? globalThis.crypto
    : undefined

const toHex = (value: number) => value.toString(16).padStart(2, '0')

export const createId = () => {
  if (safeCrypto?.randomUUID) {
    return safeCrypto.randomUUID()
  }

  if (safeCrypto?.getRandomValues) {
    const bytes = new Uint8Array(16)
    safeCrypto.getRandomValues(bytes)

    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80

    const hex = Array.from(bytes, toHex)

    return [
      hex.slice(0, 4).join(''),
      hex.slice(4, 6).join(''),
      hex.slice(6, 8).join(''),
      hex.slice(8, 10).join(''),
      hex.slice(10, 16).join('')
    ].join('-')
  }

  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export const clonePoint = (point: Point): Point => ({
  x: point.x,
  y: point.y,
  pressure: point.pressure,
  tiltX: point.tiltX,
  tiltY: point.tiltY
})

export const cloneStroke = (stroke: Stroke): Stroke => ({
  id: stroke.id,
  points: stroke.points.map(clonePoint),
  color: stroke.color,
  size: stroke.size,
  opacity: stroke.opacity,
  taper: stroke.taper,
  stabilization: stroke.stabilization,
  tip: stroke.tip,
  grain: stroke.grain,
  spacing: stroke.spacing,
  pressureSize: stroke.pressureSize,
  pressureOpacity: stroke.pressureOpacity,
  mode: stroke.mode
})

export const cloneLayer = (layer: Layer): Layer => ({
  id: layer.id,
  name: layer.name,
  visible: layer.visible,
  locked: layer.locked,
  opacity: layer.opacity,
  strokes: layer.strokes.map(cloneStroke)
})

export const cloneFrame = (frame: Frame): Frame => ({
  id: frame.id,
  exposure: frame.exposure,
  layers: frame.layers.map(cloneLayer)
})

export const cloneFrames = (frames: Frame[]) => frames.map(cloneFrame)
