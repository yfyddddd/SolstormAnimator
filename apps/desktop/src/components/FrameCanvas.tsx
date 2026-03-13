import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import {
  appendPoint,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  createStrokeFromRawPoints,
  doesStrokeIntersectRect,
  findTopStrokeAtPoint,
  getCanvasPoint,
  getLayerById,
  getSelectionBounds,
  normalizeRect,
  paintEditorScene
} from '../lib/drawing'
import { useProjectStore } from '../state/projectStore'
import type { BrushSettings, Point, Rect, StrokeMode } from '../types'

type FrameCanvasProps = {
  containerRef: RefObject<HTMLDivElement>
  isFullscreen: boolean
}

type InteractionMode = 'idle' | 'drawing' | 'marquee' | 'moving-selection'

export function FrameCanvas({ containerRef, isFullscreen }: FrameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rawPointsRef = useRef<Point[]>([])
  const interactionRef = useRef<InteractionMode>('idle')
  const pointerOriginRef = useRef<Point | null>(null)
  const lastSelectionDragPointRef = useRef<Point | null>(null)
  const additiveSelectionRef = useRef(false)

  const [rawPoints, setRawPoints] = useState<Point[]>([])
  const [activeBrush, setActiveBrush] = useState<BrushSettings | null>(null)
  const [activeStrokeMode, setActiveStrokeMode] = useState<StrokeMode>('draw')
  const [selectionRect, setSelectionRect] = useState<Rect | null>(null)

  const frames = useProjectStore((state) => state.frames)
  const currentFrameIndex = useProjectStore((state) => state.currentFrameIndex)
  const activeLayerId = useProjectStore((state) => state.activeLayerId)
  const selectedStrokeIds = useProjectStore((state) => state.selectedStrokeIds)
  const activeTool = useProjectStore((state) => state.activeTool)
  const brush = useProjectStore((state) => state.brush)
  const onionSkinEnabled = useProjectStore((state) => state.onionSkinEnabled)
  const onionSkinOpacity = useProjectStore((state) => state.onionSkinOpacity)
  const isPlaying = useProjectStore((state) => state.isPlaying)
  const fps = useProjectStore((state) => state.fps)
  const addStrokeToCurrentLayer = useProjectStore((state) => state.addStrokeToCurrentLayer)
  const setSelectedStrokeIds = useProjectStore((state) => state.setSelectedStrokeIds)
  const clearSelection = useProjectStore((state) => state.clearSelection)
  const pushHistoryCheckpoint = useProjectStore((state) => state.pushHistoryCheckpoint)
  const translateSelectedStrokes = useProjectStore((state) => state.translateSelectedStrokes)
  const stopPlayback = useProjectStore((state) => state.stopPlayback)

  const currentFrame = frames[currentFrameIndex] ?? frames[0]
  const previousFrame = currentFrameIndex > 0 ? frames[currentFrameIndex - 1] : null
  const activeLayer = getLayerById(currentFrame, activeLayerId)
  const brushForStroke = activeBrush ?? brush

  const selectedStrokes = useMemo(() => {
    const selectedSet = new Set(selectedStrokeIds)
    return activeLayer?.strokes.filter((stroke) => selectedSet.has(stroke.id)) ?? []
  }, [activeLayer, selectedStrokeIds])

  const selectionBounds = useMemo(
    () => getSelectionBounds(selectedStrokes),
    [selectedStrokes]
  )

  const previewStroke = useMemo(
    () =>
      rawPoints.length === 0 || activeTool === 'select'
        ? null
        : createStrokeFromRawPoints(
            rawPoints,
            brushForStroke,
            activeStrokeMode,
            'preview-stroke'
          ),
    [activeStrokeMode, activeTool, brushForStroke, rawPoints]
  )

  const resetLocalInteraction = () => {
    interactionRef.current = 'idle'
    rawPointsRef.current = []
    pointerOriginRef.current = null
    lastSelectionDragPointRef.current = null
    additiveSelectionRef.current = false
    setRawPoints([])
    setActiveBrush(null)
    setSelectionRect(null)
  }

  useEffect(() => {
    rawPointsRef.current = rawPoints
  }, [rawPoints])

  useEffect(() => {
    if (!canvasRef.current) {
      return
    }

    const context = canvasRef.current.getContext('2d')
    if (!context) {
      return
    }

    paintEditorScene(context, {
      currentFrame,
      previousFrame,
      previewStroke,
      previewLayerId: activeLayerId,
      selectedStrokeIds,
      activeLayerId,
      selectionRect,
      showOnionSkin: onionSkinEnabled && !isPlaying,
      onionSkinOpacity
    })
  }, [
    activeLayerId,
    currentFrame,
    onionSkinEnabled,
    onionSkinOpacity,
    isPlaying,
    previousFrame,
    previewStroke,
    selectedStrokeIds,
    selectionRect
  ])

  useEffect(() => {
    resetLocalInteraction()
  }, [activeLayerId, activeTool, currentFrameIndex, isPlaying])

  const finishDrawing = (event?: React.PointerEvent<HTMLCanvasElement>) => {
    if (interactionRef.current !== 'drawing') {
      return
    }

    if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const finalPoint = event ? getCanvasPoint(event) : null
    const completedPoints = finalPoint
      ? appendPoint(rawPointsRef.current, finalPoint, 0.1)
      : rawPointsRef.current

    const stroke = createStrokeFromRawPoints(
      completedPoints,
      brushForStroke,
      activeStrokeMode
    )

    if (stroke) {
      addStrokeToCurrentLayer(stroke)
    }

    resetLocalInteraction()
  }

  const finishSelection = (event?: React.PointerEvent<HTMLCanvasElement>) => {
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const finalPoint = event ? getCanvasPoint(event) : pointerOriginRef.current

    if (interactionRef.current === 'moving-selection') {
      resetLocalInteraction()
      return
    }

    if (interactionRef.current !== 'marquee' || !pointerOriginRef.current || !finalPoint) {
      resetLocalInteraction()
      return
    }

    const finalRect = normalizeRect(pointerOriginRef.current, finalPoint)
    const additive = additiveSelectionRef.current
    const hasDragged = finalRect.width > 4 || finalRect.height > 4

    if (!hasDragged) {
      const topStroke = findTopStrokeAtPoint(activeLayer, finalPoint)

      if (!topStroke) {
        if (!additive) {
          clearSelection()
        }

        resetLocalInteraction()
        return
      }

      if (additive) {
        const nextSelection = new Set(selectedStrokeIds)

        if (nextSelection.has(topStroke.id)) {
          nextSelection.delete(topStroke.id)
        } else {
          nextSelection.add(topStroke.id)
        }

        setSelectedStrokeIds([...nextSelection])
      } else {
        setSelectedStrokeIds([topStroke.id])
      }

      resetLocalInteraction()
      return
    }

    const marqueeSelection =
      activeLayer?.strokes
        .filter((stroke) => doesStrokeIntersectRect(stroke, finalRect))
        .map((stroke) => stroke.id) ?? []

    if (additive) {
      setSelectedStrokeIds([...new Set([...selectedStrokeIds, ...marqueeSelection])])
    } else {
      setSelectedStrokeIds(marqueeSelection)
    }

    resetLocalInteraction()
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    if (isPlaying) {
      stopPlayback()
    }

    const point = getCanvasPoint(event)

    if (activeTool === 'select') {
      interactionRef.current = 'marquee'
      pointerOriginRef.current = point
      additiveSelectionRef.current = event.shiftKey
      setSelectionRect({
        x: point.x,
        y: point.y,
        width: 0,
        height: 0
      })

      if (
        selectionBounds &&
        point.x >= selectionBounds.x &&
        point.x <= selectionBounds.x + selectionBounds.width &&
        point.y >= selectionBounds.y &&
        point.y <= selectionBounds.y + selectionBounds.height &&
        selectedStrokeIds.length > 0 &&
        !activeLayer?.locked
      ) {
        interactionRef.current = 'moving-selection'
        lastSelectionDragPointRef.current = point
        setSelectionRect(null)
        pushHistoryCheckpoint()
      }

      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }

    if (!activeLayer || activeLayer.locked) {
      return
    }

    interactionRef.current = 'drawing'
    rawPointsRef.current = [point]
    setActiveBrush(brush)
    setActiveStrokeMode(activeTool === 'eraser' ? 'erase' : 'draw')
    setRawPoints([point])
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(event)

    if (interactionRef.current === 'drawing') {
      const minimumDistance = Math.max(0.65, brushForStroke.size * 0.08)

      setRawPoints((previousPoints) => {
        const nextPoints = appendPoint(previousPoints, point, minimumDistance)
        rawPointsRef.current = nextPoints
        return nextPoints
      })

      return
    }

    if (interactionRef.current === 'moving-selection') {
      if (!lastSelectionDragPointRef.current) {
        lastSelectionDragPointRef.current = point
        return
      }

      const dx = point.x - lastSelectionDragPointRef.current.x
      const dy = point.y - lastSelectionDragPointRef.current.y

      if (dx !== 0 || dy !== 0) {
        translateSelectedStrokes(dx, dy, false)
        lastSelectionDragPointRef.current = point
      }

      return
    }

    if (interactionRef.current === 'marquee' && pointerOriginRef.current) {
      setSelectionRect(normalizeRect(pointerOriginRef.current, point))
    }
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (interactionRef.current === 'drawing') {
      finishDrawing(event)
      return
    }

    finishSelection(event)
  }

  const handlePointerCancel = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (interactionRef.current === 'drawing') {
      finishDrawing(event)
      return
    }

    finishSelection(event)
  }

  return (
    <section className="stage-panel">
      <div
        ref={containerRef}
        className={`canvas-shell ${isFullscreen ? 'fullscreen-canvas-shell' : ''}`}
      >
        <div className="canvas-overlay">
          <div className="canvas-overlay-group">
            <div className="canvas-badge">
              {isPlaying ? `Playing ${fps} FPS` : activeTool.toUpperCase()}
            </div>
            <div className="canvas-badge">
              {activeLayer?.locked ? 'Locked Layer' : activeLayer?.name ?? 'No Layer'}
            </div>
          </div>

          <div className="canvas-overlay-group">
            <div className="canvas-badge">
              Frame {currentFrameIndex + 1} of {frames.length}
            </div>
            <div className="canvas-badge">
              {selectedStrokeIds.length} selected
            </div>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className={`drawing-canvas ${isFullscreen ? 'fullscreen-canvas' : ''} ${
            activeTool === 'select' ? 'drawing-canvas-select' : ''
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        />
      </div>
    </section>
  )
}
