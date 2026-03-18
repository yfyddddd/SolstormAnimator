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
export const CANVAS_BACKGROUND = '#0f141d'
export const MIN_VIEW_SCALE = 0.2
export const MAX_VIEW_SCALE = 10

type BrushSample = {
  point: Point
  angle: number
  progress: number
  index: number
}

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export const normalizeAngle = (value: number) => Math.atan2(Math.sin(value), Math.cos(value))

export const distanceBetween = (first: Point, second: Point) =>
  Math.hypot(second.x - first.x, second.y - first.y)

const interpolateNumber = (first: number | undefined, second: number | undefined, t: number) =>
  (first ?? second ?? 0) + ((second ?? first ?? 0) - (first ?? second ?? 0)) * t

const interpolatePoint = (first: Point, second: Point, t: number): Point => ({
  x: first.x + (second.x - first.x) * t,
  y: first.y + (second.y - first.y) * t,
  pressure: interpolateNumber(first.pressure, second.pressure, t),
  tiltX: interpolateNumber(first.tiltX, second.tiltX, t),
  tiltY: interpolateNumber(first.tiltY, second.tiltY, t)
})

const hashString = (value: string) => {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

const pseudoRandom = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453123
  return value - Math.floor(value)
}

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
  const inset = Math.min(viewportWidth, viewportHeight) < 720 ? 56 : 138
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
        ...current,
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
    tip: brush.tip,
    grain: brush.grain,
    spacing: brush.spacing,
    pressureSize: brush.pressureSize,
    pressureOpacity: brush.pressureOpacity,
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

  return 0.2 + bodyFactor * 0.8
}

const getStrokeBoundsPadding = (stroke: Stroke) => {
  if (stroke.tip === 'paint') {
    return stroke.size * 0.85
  }

  if (stroke.tip === 'grain') {
    return stroke.size * 0.95
  }

  if (stroke.tip === 'stamp-star' || stroke.tip === 'stamp-square') {
    return stroke.size * 0.75
  }

  return stroke.size / 2
}

const getPointPressure = (point: Point) => clamp(point.pressure ?? 1, 0.05, 1)

const getPressureFactor = (pressure: number, influence: number) => {
  const amount = clamp(influence, 0, 100) / 100
  return 1 - amount + pressure * amount
}

const getStrokeSpacing = (stroke: Stroke) => {
  const spacingAmount = clamp(stroke.spacing, 0, 100) / 100
  const baseFactor =
    stroke.tip === 'stamp-star' || stroke.tip === 'stamp-square'
      ? 0.42
      : stroke.tip === 'grain'
        ? 0.26
        : stroke.tip === 'paint'
          ? 0.18
          : 0.12

  return Math.max(0.7, stroke.size * (baseFactor + spacingAmount * 0.52))
}

const sampleStroke = (stroke: Stroke): BrushSample[] => {
  if (stroke.points.length === 0) {
    return []
  }

  if (stroke.points.length === 1) {
    return [
      {
        point: stroke.points[0],
        angle: 0,
        progress: 0,
        index: 0
      }
    ]
  }

  const segmentLengths: number[] = []
  let totalLength = 0

  for (let index = 1; index < stroke.points.length; index += 1) {
    const segmentLength = distanceBetween(stroke.points[index - 1], stroke.points[index])
    segmentLengths.push(segmentLength)
    totalLength += segmentLength
  }

  if (totalLength === 0) {
    return [
      {
        point: stroke.points[0],
        angle: 0,
        progress: 0,
        index: 0
      }
    ]
  }

  const spacing = getStrokeSpacing(stroke)
  const samples: BrushSample[] = []
  let targetDistance = 0
  let segmentIndex = 0
  let segmentStartDistance = 0

  while (targetDistance <= totalLength) {
    while (
      segmentIndex < segmentLengths.length - 1 &&
      segmentStartDistance + segmentLengths[segmentIndex] < targetDistance
    ) {
      segmentStartDistance += segmentLengths[segmentIndex]
      segmentIndex += 1
    }

    const firstPoint = stroke.points[segmentIndex]
    const secondPoint = stroke.points[segmentIndex + 1] ?? stroke.points[segmentIndex]
    const segmentLength = Math.max(segmentLengths[segmentIndex] ?? 0, 0.0001)
    const distanceIntoSegment = clamp(
      targetDistance - segmentStartDistance,
      0,
      segmentLength
    )
    const t = distanceIntoSegment / segmentLength
    const point = interpolatePoint(firstPoint, secondPoint, t)

    samples.push({
      point,
      angle: Math.atan2(secondPoint.y - firstPoint.y, secondPoint.x - firstPoint.x),
      progress: clamp(targetDistance / totalLength, 0, 1),
      index: samples.length
    })

    targetDistance += spacing
  }

  const lastPoint = stroke.points[stroke.points.length - 1]
  const lastAngle = Math.atan2(
    lastPoint.y - stroke.points[stroke.points.length - 2].y,
    lastPoint.x - stroke.points[stroke.points.length - 2].x
  )

  if (samples.length === 0 || samples[samples.length - 1].progress < 1) {
    samples.push({
      point: lastPoint,
      angle: lastAngle,
      progress: 1,
      index: samples.length
    })
  }

  return samples
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

  const padding = Math.max(2, getStrokeBoundsPadding(stroke))
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

  const radius = Math.max(3, getStrokeBoundsPadding(stroke)) + padding

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

const getSampleSize = (stroke: Stroke, sample: BrushSample) => {
  const pressure = getPointPressure(sample.point)
  return Math.max(
    0.35,
    stroke.size *
      getTaperFactor(sample.progress, stroke.taper) *
      getPressureFactor(pressure, stroke.pressureSize)
  )
}

const getSampleAlpha = (stroke: Stroke, sample: BrushSample, alpha: number) =>
  clamp(alpha, 0, 1) *
  clamp(stroke.opacity, 0, 1) *
  getPressureFactor(getPointPressure(sample.point), stroke.pressureOpacity)

const getTiltData = (point: Point, fallbackAngle: number) => {
  const tiltX = point.tiltX ?? 0
  const tiltY = point.tiltY ?? 0
  const magnitude = clamp(Math.hypot(tiltX, tiltY) / 90, 0, 1)

  return {
    magnitude,
    angle: tiltX === 0 && tiltY === 0 ? fallbackAngle : Math.atan2(tiltY, tiltX)
  }
}

const drawTextureSpeckles = (
  context: CanvasRenderingContext2D,
  stroke: Stroke,
  sample: BrushSample,
  size: number,
  alpha: number,
  seedBase: number
) => {
  const intensity = clamp(stroke.grain, 0, 100) / 100

  if (intensity === 0) {
    return
  }

  const speckleCount = Math.max(2, Math.round(3 + intensity * 9 + size / 7))

  for (let index = 0; index < speckleCount; index += 1) {
    const radiusSeed = seedBase + sample.index * 131 + index * 17
    const angleSeed = seedBase + sample.index * 97 + index * 53
    const distanceSeed = seedBase + sample.index * 173 + index * 29
    const speckleRadius = (0.06 + pseudoRandom(radiusSeed) * 0.14) * size
    const speckleAngle = pseudoRandom(angleSeed) * Math.PI * 2
    const speckleDistance = pseudoRandom(distanceSeed) * size * (0.3 + intensity * 0.55)

    context.globalAlpha = alpha * (0.16 + intensity * 0.28)
    context.beginPath()
    context.arc(
      sample.point.x + Math.cos(speckleAngle) * speckleDistance,
      sample.point.y + Math.sin(speckleAngle) * speckleDistance,
      speckleRadius,
      0,
      Math.PI * 2
    )
    context.fill()
  }
}

const drawRoundStamp = (
  context: CanvasRenderingContext2D,
  stroke: Stroke,
  sample: BrushSample,
  size: number,
  alpha: number,
  seedBase: number
) => {
  context.globalAlpha = alpha
  context.beginPath()
  context.arc(sample.point.x, sample.point.y, size / 2, 0, Math.PI * 2)
  context.fill()
  drawTextureSpeckles(context, stroke, sample, size, alpha, seedBase)
}

const drawFineStamp = (
  context: CanvasRenderingContext2D,
  sample: BrushSample,
  size: number,
  alpha: number
) => {
  context.save()
  context.translate(sample.point.x, sample.point.y)
  context.rotate(sample.angle)
  context.globalAlpha = alpha
  context.beginPath()
  context.ellipse(0, 0, size * 0.42, size * 0.28, 0, 0, Math.PI * 2)
  context.fill()
  context.restore()
}

const drawPaintStamp = (
  context: CanvasRenderingContext2D,
  stroke: Stroke,
  sample: BrushSample,
  size: number,
  alpha: number,
  seedBase: number
) => {
  const tilt = getTiltData(sample.point, sample.angle + Math.PI / 2)
  const bristleCount = Math.max(3, Math.round(size / 4.5))
  const spread = size * (0.16 + tilt.magnitude * 0.42)

  context.save()
  context.translate(sample.point.x, sample.point.y)
  context.rotate(sample.angle + tilt.angle * 0.04)

  for (let index = 0; index < bristleCount; index += 1) {
    const mix = bristleCount === 1 ? 0 : index / (bristleCount - 1)
    const offset = (mix - 0.5) * spread
    const jitter = (pseudoRandom(seedBase + sample.index * 61 + index * 13) - 0.5) * size * 0.18
    const width = size * (0.18 + pseudoRandom(seedBase + sample.index * 37 + index * 11) * 0.14)
    const height = size * (0.42 + pseudoRandom(seedBase + sample.index * 41 + index * 7) * 0.18)

    context.globalAlpha = alpha * (0.28 + pseudoRandom(seedBase + sample.index * 19 + index * 5) * 0.4)
    context.beginPath()
    context.ellipse(jitter, offset, width, height, 0, 0, Math.PI * 2)
    context.fill()
  }

  context.restore()
  drawTextureSpeckles(context, stroke, sample, size * 0.9, alpha, seedBase + 91)
}

const drawGrainStamp = (
  context: CanvasRenderingContext2D,
  stroke: Stroke,
  sample: BrushSample,
  size: number,
  alpha: number,
  seedBase: number
) => {
  const density = clamp(stroke.grain, 0, 100) / 100
  const dustCount = Math.max(6, Math.round(size * 0.4 + density * 14))

  for (let index = 0; index < dustCount; index += 1) {
    const angle = pseudoRandom(seedBase + sample.index * 89 + index * 13) * Math.PI * 2
    const distance = pseudoRandom(seedBase + sample.index * 67 + index * 17) * size * 0.62
    const radius = size * (0.05 + pseudoRandom(seedBase + sample.index * 43 + index * 23) * 0.08)

    context.globalAlpha = alpha * (0.12 + density * 0.3)
    context.beginPath()
    context.arc(
      sample.point.x + Math.cos(angle) * distance,
      sample.point.y + Math.sin(angle) * distance,
      radius,
      0,
      Math.PI * 2
    )
    context.fill()
  }

  context.globalAlpha = alpha * 0.22
  context.beginPath()
  context.arc(sample.point.x, sample.point.y, size * 0.22, 0, Math.PI * 2)
  context.fill()
}

const drawStarShape = (
  context: CanvasRenderingContext2D,
  points: number,
  outerRadius: number,
  innerRadius: number
) => {
  context.beginPath()

  for (let index = 0; index < points * 2; index += 1) {
    const angle = -Math.PI / 2 + (Math.PI * index) / points
    const radius = index % 2 === 0 ? outerRadius : innerRadius
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius

    if (index === 0) {
      context.moveTo(x, y)
    } else {
      context.lineTo(x, y)
    }
  }

  context.closePath()
  context.fill()
}

const drawStampShape = (
  context: CanvasRenderingContext2D,
  stroke: Stroke,
  sample: BrushSample,
  size: number,
  alpha: number,
  seedBase: number
) => {
  const tilt = getTiltData(sample.point, sample.angle)
  const randomTwist = (pseudoRandom(seedBase + sample.index * 19) - 0.5) * 0.14

  context.save()
  context.translate(sample.point.x, sample.point.y)
  context.rotate(sample.angle + tilt.angle * 0.08 + randomTwist)
  context.globalAlpha = alpha

  if (stroke.tip === 'stamp-star') {
    drawStarShape(context, 5, size * 0.54, size * 0.24)
  } else {
    context.beginPath()
    context.rect(-size * 0.4, -size * 0.4, size * 0.8, size * 0.8)
    context.fill()
  }

  context.restore()
}

export const drawStroke = (
  context: CanvasRenderingContext2D,
  stroke: Stroke,
  alpha = 1
) => {
  if (stroke.points.length === 0) {
    return
  }

  const samples = sampleStroke(stroke)
  const seedBase = hashString(stroke.id)

  context.save()
  context.globalCompositeOperation = stroke.mode === 'erase' ? 'destination-out' : 'source-over'
  context.fillStyle = stroke.color
  context.strokeStyle = stroke.color
  context.lineCap = 'round'
  context.lineJoin = 'round'

  for (const sample of samples) {
    const size = getSampleSize(stroke, sample)
    const sampleAlpha = getSampleAlpha(stroke, sample, alpha)

    switch (stroke.tip) {
      case 'fine':
        drawFineStamp(context, sample, size, sampleAlpha)
        break
      case 'paint':
        drawPaintStamp(context, stroke, sample, size, sampleAlpha, seedBase)
        break
      case 'grain':
        drawGrainStamp(context, stroke, sample, size, sampleAlpha, seedBase)
        break
      case 'stamp-star':
      case 'stamp-square':
        drawStampShape(context, stroke, sample, size, sampleAlpha, seedBase)
        break
      case 'round':
      default:
        drawRoundStamp(context, stroke, sample, size, sampleAlpha, seedBase)
    }
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
    Math.max(viewportWidth, viewportHeight) * 0.8
  )
  backdrop.addColorStop(0, '#162231')
  backdrop.addColorStop(1, '#091018')
  context.fillStyle = backdrop
  context.fillRect(0, 0, viewportWidth, viewportHeight)

  context.save()
  context.translate(viewportWidth / 2 + viewport.offsetX, viewportHeight / 2 + viewport.offsetY)
  context.rotate(viewport.rotation)
  context.scale(viewport.scale, viewport.scale)
  context.translate(-CANVAS_WIDTH / 2, -CANVAS_HEIGHT / 2)

  context.save()
  context.shadowColor = 'rgba(0, 0, 0, 0.4)'
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

  context.strokeStyle = 'rgba(214, 224, 240, 0.5)'
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
