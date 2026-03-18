export type Point = {
  x: number
  y: number
  pressure?: number
  tiltX?: number
  tiltY?: number
}

export type Rect = {
  x: number
  y: number
  width: number
  height: number
}

export type Tool = 'brush' | 'eraser' | 'select'

export type DrawingTool = Exclude<Tool, 'select'>

export type BrushTip =
  | 'round'
  | 'fine'
  | 'paint'
  | 'grain'
  | 'stamp-star'
  | 'stamp-square'

export type BrushPresetId =
  | 'round-brush'
  | 'fine-liner'
  | 'paintbrush'
  | 'grain-shader'
  | 'star-stamp'
  | 'square-stamp'
  | 'soft-eraser'
  | 'block-eraser'

export type StrokeMode = 'draw' | 'erase'

export type Stroke = {
  id: string
  points: Point[]
  color: string
  size: number
  opacity: number
  taper: number
  stabilization: number
  tip: BrushTip
  grain: number
  spacing: number
  pressureSize: number
  pressureOpacity: number
  mode: StrokeMode
}

export type Layer = {
  id: string
  name: string
  visible: boolean
  locked: boolean
  opacity: number
  strokes: Stroke[]
}

export type Frame = {
  id: string
  exposure: number
  layers: Layer[]
}

export type BrushSettings = {
  presetId: BrushPresetId
  color: string
  size: number
  opacity: number
  taper: number
  stabilization: number
  tip: BrushTip
  grain: number
  spacing: number
  pressureSize: number
  pressureOpacity: number
}

export type SelectionBounds = Rect & {
  center: Point
}

export type ViewTransform = {
  scale: number
  rotation: number
  offsetX: number
  offsetY: number
}
