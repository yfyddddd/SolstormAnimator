import type {
  BrushSettings,
  Frame,
  Layer,
  Point,
  Rect,
  SelectionBounds,
  Stroke,
  StrokeMode,
  ViewTransform
} from '../types'
import { createId } from './compat'

export const CANVAS_WIDTH = 960
export const CANVAS_HEIGHT = 540
export const CANVAS_BACKGROUND = '#111318'
export const MIN_VIEW_SCALE = 0.2
export const MAX_VIEW_SCALE = 10

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export const normalizeAngle = (value: number) => Math.atan2(Math.sin(value), Math.cos(value))

export const distanceBetween = (first: Point, second: Point) =>
  Math.hypot(second.x - first.x, second.y - first.y)

export const appendPoint = (
  points: Point[],
  nextPoint: Point,
  minimumDistance = 0.7
) => {
  if (points.length === 0) {
    return [nextPoint]
  }

  const lastPoint = points[points.length - 1]

  if (distanceBetween(lastPoint, nextPoint) < minimumDistance) {
    return points
  }

  return [...points, nextPoint]
}

export const normalizeRect = (first: Point, second: Point): Rect => ({
  x: Math.min(first.x, second.x),
  y: Math.min(first.y, second.y),
  width: Math.abs(second.x - first.x),
  height: Math.abs(second.y - first.y)
})

export const getRelativePoint = (
  element: HTMLCanvasElement | HTMLElement,
  clientX: number,
  clientY: number
): Point => {
  const rect = element.getBoundingClientRect()

  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  }
}

export const createFittedViewTransform = (
  viewportWidth: number,
  viewportHeight: number
): ViewTransform => {
  const inset = Math.min(viewportWidth, viewportHeight) < 720 ? 56 : 132
  const usableWidth = Math.max(220, viewportWidth - inset * 2)
  const usableHeight = Math.max(180, viewportHeight - inset * 2)

  return {
    scale: clamp(
      Math.min(usableWidth / CANVAS_WIDTH, usableHeight / CANVAS_HEIGHT),
      MIN_VIEW_SCALE,
      4
    ),
    rotation: 0,
    offsetX: 0,
    offsetY: 0
  }
}

export const worldToScreenPoint = (
  point: Point,
  viewport: ViewTransform,
  viewportWidth: number,
  viewportHeight: number
): Point => {
  const localX = point.x - CANVAS_WIDTH / 2
  const localY = point.y - CANVAS_HEIGHT / 2
  const scaledX = localX * viewport.scale
  const scaledY = localY * viewport.scale
  const cos = Math.cos(viewport.rotation)
  const sin = Math.sin(viewport.rotation)

  return {
    x: viewportWidth / 2 + viewport.offsetX + scaledX * cos - scaledY * sin,
    y: viewportHeight / 2 + viewport.offsetY + scaledX * sin + scaledY * cos
  }
}

export const screenToWorldPoint = (
  point: Point,
  viewport: ViewTransform,
  viewportWidth: number,
  viewportHeight: number
): Point => {
  const translatedX = point.x - (viewportWidth / 2 + viewport.offsetX)
  const translatedY = point.y - (viewportHeight / 2 + viewport.offsetY)
  const cos = Math.cos(viewport.rotation)
  const sin = Math.sin(viewport.rotation)
  const localX = (translatedX * cos + translatedY * sin) / viewport.scale
  const localY = (-translatedX * sin + translatedY * cos) / viewport.scale

  return {
    x: CANVAS_WIDTH / 2 + localX,
    y: CANVAS_HEIGHT / 2 + localY
  }
}

export const getViewportOffsetForAnchor = (
  worldPoint: Point,
  screenPoint: Point,
  viewportWidth: number,
  viewportHeight: number,
  scale: number,
  rotation: number
) => {
  const localX = worldPoint.x - CANVAS_WIDTH / 2
  const localY = worldPoint.y - CANVAS_HEIGHT / 2
  const scaledX = localX * scale
  const scaledY = localY * scale
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)

  return {
    offsetX: screenPoint.x - viewportWidth / 2 - (scaledX * cos - scaledY * sin),
    offsetY: screenPoint.y - viewportHeight / 2 - (scaledX * sin + scaledY * cos)
  }
}

export const stabilizePoints = (points: Point[], stabilization: number) => {
  const amount = clamp(stabilization, 0, 100) / 100

  if (points.length < 3 || amount === 0) {
    return points.map((point) => ({ ...point }))
  }

  const passes = Math.max(1, Math.round(amount * 4))
  const weight = 0.14 + amount * 0.42

  let smoothed = points.map((point) => ({ ...point }))

  for (let pass = 0; pass < passes; pass += 1) {
    const next = [smoothed[0]]

    for (let index = 1; index < smoothed.length - 1; index += 1) {
      const previous = smoothed[index - 1]
      const current = smoothed[index]
      const following = smoothed[index + 1]

      const averageX = (previous.x + current.x + following.x) / 3
      const averageY = (previous.y + current.y + following.y) / 3

      next.push({
        x: current.x + (averageX - current.x) * weight,
        y: current.y + (averageY - current.y) * weight
      })
    }

    next.push(smoothed[smoothed.length - 1])
    smoothed = next
  }

  return smoothed
}

export const createStrokeFromRawPoints = (
  rawPoints: Point[],
  brush: BrushSettings,
  mode: StrokeMode,
  strokeId: string = createId()
) => {
  const points = stabilizePoints(rawPoints, brush.stabilization)

  if (points.length === 0) {
    return null
  }

  return {
    id: strokeId,
    points,
    color: brush.color,
    size: brush.size,
    opacity: brush.opacity,
    taper: brush.taper,
    stabilization: brush.stabilization,
    mode
  } satisfies Stroke
}

const getTaperFactor = (progress: number, taper: number) => {
  const amount = clamp(taper, 0, 100) / 100

  if (amount === 0) {
    return 1
  }

  const edgeSpan = Math.max(0.04, amount * 0.45)
  const startFactor = Math.min(1, progress / edgeSpan)
  const endFactor = Math.min(1, (1 - progress) / edgeSpan)
  const bodyFactor = Math.min(1, startFactor, endFactor)

  return 0.22 + bodyFactor * 0.78
}

const getStrokeWidths = (stroke: Stroke) => {
  if (stroke.points.length === 1) {
    return [stroke.size]
  }

  const cumulativeLengths = [0]
  let totalLength = 0

  for (let index = 1; index < stroke.points.length; index += 1) {
    totalLength += distanceBetween(stroke.points[index - 1], stroke.points[index])
    cumulativeLengths.push(totalLength)
  }

  if (totalLength === 0) {
    return stroke.points.map(() => stroke.size)
  }

  return cumulativeLengths.map((length) => {
    const progress = length / totalLength
    return Math.max(0.35, stroke.size * getTaperFactor(progress, stroke.taper))
  })
}

const distancePointToSegment = (point: Point, start: Point, end: Point) => {
  const segmentLengthSquared =
    (end.x - start.x) * (end.x - start.x) + (end.y - start.y) * (end.y - start.y)

  if (segmentLengthSquared === 0) {
    return distanceBetween(point, start)
  }

  const projection = clamp(
    ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) /
      segmentLengthSquared,
    0,
    1
  )

  const projectedPoint = {
    x: start.x + (end.x - start.x) * projection,
    y: start.y + (end.y - start.y) * projection
  }

  return distanceBetween(point, projectedPoint)
}

export const getStrokeBounds = (stroke: Stroke): Rect | null => {
  if (stroke.points.length === 0) {
    return null
  }

  const padding = Math.max(2, stroke.size / 2)
  let minX = stroke.points[0].x - padding
  let minY = stroke.points[0].y - padding
  let maxX = stroke.points[0].x + padding
  let maxY = stroke.points[0].y + padding

  for (const point of stroke.points) {
    minX = Math.min(minX, point.x - padding)
    minY = Math.min(minY, point.y - padding)
    maxX = Math.max(maxX, point.x + padding)
    maxY = Math.max(maxY, point.y + padding)
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

export const pointHitsStroke = (point: Point, stroke: Stroke, padding = 6) => {
  const bounds = getStrokeBounds(stroke)

  if (!bounds) {
    return false
  }

  if (
    point.x < bounds.x - padding ||
    point.x > bounds.x + bounds.width + padding ||
    point.y < bounds.y - padding ||
    point.y > bounds.y + bounds.height + padding
  ) {
    return false
  }

  if (stroke.points.length === 1) {
    return distanceBetween(point, stroke.points[0]) <= stroke.size / 2 + padding
  }

  const radius = Math.max(3, stroke.size / 2) + padding

  for (let index = 1; index < stroke.points.length; index += 1) {
    if (
      distancePointToSegment(point, stroke.points[index - 1], stroke.points[index]) <= radius
    ) {
      return true
    }
  }

  return false
}

export const doesStrokeIntersectRect = (stroke: Stroke, rect: Rect) => {
  const bounds = getStrokeBounds(stroke)

  if (!bounds) {
    return false
  }

  return !(
    bounds.x + bounds.width < rect.x ||
    bounds.x > rect.x + rect.width ||
    bounds.y + bounds.height < rect.y ||
    bounds.y > rect.y + rect.height
  )
}

export const findTopStrokeAtPoint = (layer: Layer | null | undefined, point: Point) => {
  if (!layer) {
    return null
  }

  for (let index = layer.strokes.length - 1; index >= 0; index -= 1) {
    const stroke = layer.strokes[index]

    if (pointHitsStroke(point, stroke)) {
      return stroke
    }
  }

  return null
}

export const getSelectionBounds = (strokes: Stroke[]): SelectionBounds | null => {
  const bounds = strokes
    .map(getStrokeBounds)
    .filter((bound): bound is Rect => Boolean(bound))

  if (bounds.length === 0) {
    return null
  }

  const minX = Math.min(...bounds.map((bound) => bound.x))
  const minY = Math.min(...bounds.map((bound) => bound.y))
  const maxX = Math.max(...bounds.map((bound) => bound.x + bound.width))
  const maxY = Math.max(...bounds.map((bound) => bound.y + bound.height))

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2
    }
  }
}

export const countFrameStrokes = (frame: Frame) =>
  frame.layers.reduce((total, layer) => total + layer.strokes.length, 0)

export const getLayerById = (frame: Frame, layerId: string) =>
  frame.layers.find((layer) => layer.id === layerId) ?? frame.layers[0] ?? null

const getScratchContext = () => {
  if (typeof document === 'undefined') {
    return null
  }

  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_WIDTH
  canvas.height = CANVAS_HEIGHT

  return {
    canvas,
    context: canvas.getContext('2d')
  }
}

export const drawStroke = (
  context: CanvasRenderingContext2D,
  stroke: Stroke,
  alpha = 1
) => {
  if (stroke.points.length === 0) {
    return
  }

  context.save()
  context.globalCompositeOperation = stroke.mode === 'erase' ? 'destination-out' : 'source-over'
  context.globalAlpha = clamp(alpha, 0, 1) * clamp(stroke.opacity, 0, 1)
  context.strokeStyle = stroke.color
  context.fillStyle = stroke.color
  context.lineCap = 'round'
  context.lineJoin = 'round'

  if (stroke.points.length === 1) {
    context.beginPath()
    context.arc(stroke.points[0].x, stroke.points[0].y, stroke.size / 2, 0, Math.PI * 2)
    context.fill()
    context.restore()
    return
  }

  const widths = getStrokeWidths(stroke)

  for (let index = 1; index < stroke.points.length; index += 1) {
    const previous = stroke.points[index - 1]
    const current = stroke.points[index]
    const segmentWidth = (widths[index - 1] + widths[index]) / 2

    context.lineWidth = segmentWidth
    context.beginPath()
    context.moveTo(previous.x, previous.y)
    context.lineTo(current.x, current.y)
    context.stroke()

    if (index === 1) {
      context.beginPath()
      context.arc(previous.x, previous.y, widths[0] / 2, 0, Math.PI * 2)
      context.fill()
    }

    context.beginPath()
    context.arc(current.x, current.y, widths[index] / 2, 0, Math.PI * 2)
    context.fill()
  }

  context.restore()
}

const drawLayerToContext = (
  targetContext: CanvasRenderingContext2D,
  layer: Layer,
  alpha = 1,
  options?: {
    previewStroke?: Stroke | null
    drawExistingStrokes?: boolean
  }
) => {
  const scratch = getScratchContext()

  if (!scratch?.context) {
    return
  }

  scratch.context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  if (options?.drawExistingStrokes !== false) {
    for (const stroke of layer.strokes) {
      drawStroke(scratch.context, stroke, 1)
    }
  }

  if (options?.previewStroke) {
    drawStroke(scratch.context, options.previewStroke, 1)
  }

  targetContext.save()
  targetContext.globalAlpha = clamp(alpha, 0, 1) * clamp(layer.opacity, 0, 1)
  targetContext.drawImage(scratch.canvas, 0, 0)
  targetContext.restore()
}

const drawFrameToContext = (
  context: CanvasRenderingContext2D,
  frame: Frame,
  alpha = 1,
  options?: {
    previewStroke?: Stroke | null
    previewLayerId?: string | null
  }
) => {
  for (const layer of frame.layers) {
    const isPreviewLayer = options?.previewStroke && layer.id === options.previewLayerId
    const shouldDrawExistingStrokes = layer.visible

    if (!shouldDrawExistingStrokes && !isPreviewLayer) {
      continue
    }

    drawLayerToContext(context, layer, alpha, {
      previewStroke: isPreviewLayer ? options?.previewStroke : null,
      drawExistingStrokes: shouldDrawExistingStrokes
    })
  }
}

const drawSelectionOverlay = (
  context: CanvasRenderingContext2D,
  bounds: SelectionBounds | null,
  scale: number
) => {
  if (!bounds) {
    return
  }

  const uiScale = 1 / Math.max(scale, 0.0001)

  context.save()
  context.setLineDash([10 * uiScale, 7 * uiScale])
  context.lineWidth = 2 * uiScale
  context.strokeStyle = '#8db3ff'
  context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)
  context.fillStyle = '#8db3ff'
  context.beginPath()
  context.arc(bounds.center.x, bounds.center.y, 4.5 * uiScale, 0, Math.PI * 2)
  context.fill()
  context.restore()
}

const drawMarqueeRect = (
  context: CanvasRenderingContext2D,
  rect: Rect | null,
  scale: number
) => {
  if (!rect) {
    return
  }

  const uiScale = 1 / Math.max(scale, 0.0001)

  context.save()
  context.fillStyle = 'rgba(109, 146, 232, 0.14)'
  context.strokeStyle = 'rgba(141, 179, 255, 0.95)'
  context.lineWidth = 1.5 * uiScale
  context.setLineDash([8 * uiScale, 5 * uiScale])
  context.fillRect(rect.x, rect.y, rect.width, rect.height)
  context.strokeRect(rect.x, rect.y, rect.width, rect.height)
  context.restore()
}

type PaintEditorSceneOptions = {
  currentFrame?: Frame | null
  previousFrame?: Frame | null
  previewStroke?: Stroke | null
  previewLayerId?: string | null
  selectedStrokeIds?: string[]
  activeLayerId?: string | null
  selectionRect?: Rect | null
  showOnionSkin?: boolean
  onionSkinOpacity?: number
  viewport: ViewTransform
  viewportWidth: number
  viewportHeight: number
}

export const paintEditorScene = (
  context: CanvasRenderingContext2D,
  options: PaintEditorSceneOptions
) => {
  const { viewportWidth, viewportHeight, viewport } = options

  context.clearRect(0, 0, viewportWidth, viewportHeight)

  const backdrop = context.createRadialGradient(
    viewportWidth * 0.5,
    viewportHeight * 0.32,
    0,
    viewportWidth * 0.5,
    viewportHeight * 0.5,
    Math.max(viewportWidth, viewportHeight) * 0.75
  )
  backdrop.addColorStop(0, '#16202d')
  backdrop.addColorStop(1, '#0b1118')
  context.fillStyle = backdrop
  context.fillRect(0, 0, viewportWidth, viewportHeight)

  context.save()
  context.translate(viewportWidth / 2 + viewport.offsetX, viewportHeight / 2 + viewport.offsetY)
  context.rotate(viewport.rotation)
  context.scale(viewport.scale, viewport.scale)
  context.translate(-CANVAS_WIDTH / 2, -CANVAS_HEIGHT / 2)

  context.save()
  context.shadowColor = 'rgba(0, 0, 0, 0.38)'
  context.shadowBlur = 34 / Math.max(viewport.scale, 0.25)
  context.fillStyle = CANVAS_BACKGROUND
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  context.restore()

  context.save()
  context.beginPath()
  context.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  context.clip()

  if (options.showOnionSkin && options.previousFrame) {
    drawFrameToContext(context, options.previousFrame, options.onionSkinOpacity ?? 0.18)
  }

  if (options.currentFrame) {
    drawFrameToContext(context, options.currentFrame, 1, {
      previewStroke: options.previewStroke,
      previewLayerId: options.previewLayerId
    })
  } else if (options.previewStroke) {
    drawStroke(context, options.previewStroke, 1)
  }

  context.restore()

  context.strokeStyle = 'rgba(181, 196, 222, 0.56)'
  context.lineWidth = 1 / Math.max(viewport.scale, 0.0001)
  context.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  if (options.currentFrame) {
    const activeLayer = options.activeLayerId
      ? getLayerById(options.currentFrame, options.activeLayerId)
      : null
    const selectedSet = new Set(options.selectedStrokeIds ?? [])
    const selectedStrokes =
      activeLayer?.strokes.filter((stroke) => selectedSet.has(stroke.id)) ?? []

    drawSelectionOverlay(context, getSelectionBounds(selectedStrokes), viewport.scale)
  }

  drawMarqueeRect(context, options.selectionRect ?? null, viewport.scale)
  context.restore()
}

export const drawFrameThumbnail = (
  context: CanvasRenderingContext2D,
  frame: Frame,
  width: number,
  height: number
) => {
  context.clearRect(0, 0, width, height)
  context.fillStyle = CANVAS_BACKGROUND
  context.fillRect(0, 0, width, height)

  context.save()
  context.scale(width / CANVAS_WIDTH, height / CANVAS_HEIGHT)
  drawFrameToContext(context, frame)
  context.restore()
}
