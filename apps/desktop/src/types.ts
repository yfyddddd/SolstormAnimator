export type Point = {
  x: number
  y: number
}

export type Rect = {
  x: number
  y: number
  width: number
  height: number
}

export type Tool = 'brush' | 'eraser' | 'select'

export type StrokeMode = 'draw' | 'erase'

export type Stroke = {
  id: string
  points: Point[]
  color: string
  size: number
  opacity: number
  taper: number
  stabilization: number
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
  color: string
  size: number
  opacity: number
  taper: number
  stabilization: number
}

export type SelectionBounds = Rect & {
  center: Point
}
