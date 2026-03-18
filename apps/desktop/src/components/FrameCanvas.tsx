import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as CanvasPointerEvent } from 'react'
import {
  appendPoint,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  clamp,
  createFittedViewTransform,
  createStrokeFromRawPoints,
  doesStrokeIntersectRect,
  distanceBetween,
  findTopStrokeAtPoint,
  getLayerById,
  getRelativePoint,
  getSelectionBounds,
  getViewportOffsetForAnchor,
  MAX_VIEW_SCALE,
  MIN_VIEW_SCALE,
  normalizeAngle,
  normalizeRect,
  paintEditorScene,
  screenToWorldPoint
} from '../lib/drawing'
import { useProjectStore } from '../state/projectStore'
import type { BrushSettings, Point, Rect, StrokeMode, ViewTransform } from '../types'

type FrameCanvasProps = {
  isFullscreen: boolean
  viewResetToken: number
}

type InteractionMode = 'idle' | 'drawing' | 'marquee' | 'moving-selection'

type CanvasSize = {
  width: number
  height: number
  pixelRatio: number
}

type ViewPanSnapshot = {
  pointerId: number
  origin: Point
  viewport: ViewTransform
}

type TouchPointerSnapshot = {
  clientX: number
  clientY: number
}

type GestureSnapshot = {
  pointerIds: [number, number]
  viewport: ViewTransform
  distance: number
  angle: number
  worldMidpoint: Point
}

export function FrameCanvas({ isFullscreen, viewResetToken }: FrameCanvasProps) {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rawPointsRef = useRef<Point[]>([])
  const viewportRef = useRef<ViewTransform>({
    scale: 1,
    rotation: 0,
    offsetX: 0,
    offsetY: 0
  })
  const interactionRef = useRef<InteractionMode>('idle')
  const pointerOriginRef = useRef<Point | null>(null)
  const lastSelectionDragPointRef = useRef<Point | null>(null)
  const additiveSelectionRef = useRef(false)
  const initializedViewRef = useRef(false)
  const viewPanRef = useRef<ViewPanSnapshot | null>(null)
  const touchPointersRef = useRef(new Map<number, TouchPointerSnapshot>())
  const gestureRef = useRef<GestureSnapshot | null>(null)
  const activePenPointersRef = useRef(new Set<number>())
  const lastPenInputTimeRef = useRef(0)

  const [canvasSize, setCanvasSize] = useState<CanvasSize>({
    width: 1,
    height: 1,
    pixelRatio: typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2)
  })
  const [viewport, setViewport] = useState<ViewTransform>(viewportRef.current)
  const [rawPoints, setRawPoints] = useState<Point[]>([])
  const [activeBrush, setActiveBrush] = useState<BrushSettings | null>(null)
  const [activeStrokeMode, setActiveStrokeMode] = useState<StrokeMode>('draw')
  const [selectionRect, setSelectionRect] = useState<Rect | null>(null)

  const frames = useProjectStore((state) => state.frames)
  const currentFrameIndex = useProjectStore((state) => state.currentFrameIndex)
  const activeLayerId = useProjectStore((state) => state.activeLayerId)
  const selectedStrokeIds = useProjectStore((state) => state.selectedStrokeIds)
  const activeTool = useProjectStore((state) => state.activeTool)
  const lastDrawingTool = useProjectStore((state) => state.lastDrawingTool)
  const toolPresets = useProjectStore((state) => state.toolPresets)
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

  const editableTool = activeTool === 'select' ? lastDrawingTool : activeTool
  const brush = toolPresets[editableTool]
  const currentFrame = frames[currentFrameIndex] ?? frames[0]
  const previousFrame = currentFrameIndex > 0 ? frames[currentFrameIndex - 1] : null
  const activeLayer = getLayerById(currentFrame, activeLayerId)
  const brushForStroke = activeBrush ?? brush

  const selectedStrokes = useMemo(() => {
    const selectedSet = new Set(selectedStrokeIds)
    return activeLayer?.strokes.filter((stroke) => selectedSet.has(stroke.id)) ?? []
  }, [activeLayer, selectedStrokeIds])

  const selectionBounds = useMemo(() => getSelectionBounds(selectedStrokes), [selectedStrokes])

  const previewStroke = useMemo(
    () =>
      rawPoints.length === 0 || activeTool === 'select'
        ? null
        : createStrokeFromRawPoints(rawPoints, brushForStroke, activeStrokeMode, 'preview-stroke'),
    [activeStrokeMode, activeTool, brushForStroke, rawPoints]
  )

  const updateViewport = (
    nextViewport: ViewTransform | ((current: ViewTransform) => ViewTransform)
  ) => {
    setViewport((currentViewport) => {
      const resolvedViewport =
        typeof nextViewport === 'function' ? nextViewport(currentViewport) : nextViewport
      viewportRef.current = resolvedViewport
      return resolvedViewport
    })
  }

  const resetViewToFit = () => {
    if (canvasSize.width <= 1 || canvasSize.height <= 1) {
      return
    }

    const fittedViewport = createFittedViewTransform(canvasSize.width, canvasSize.height)
    viewportRef.current = fittedViewport
    setViewport(fittedViewport)
  }

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

  const clearNavigationState = () => {
    viewPanRef.current = null
    touchPointersRef.current.clear()
    gestureRef.current = null
  }

  const notePenActivity = (pointerId: number, active: boolean) => {
    lastPenInputTimeRef.current = performance.now()

    if (active) {
      activePenPointersRef.current.add(pointerId)
    } else {
      activePenPointersRef.current.delete(pointerId)
    }
  }

  const shouldRejectTouchForPalm = () =>
    activePenPointersRef.current.size > 0 || performance.now() - lastPenInputTimeRef.current < 650

  const getScreenPointFromClient = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current

    if (!canvas) {
      return { x: 0, y: 0 }
    }

    return getRelativePoint(canvas, clientX, clientY)
  }

  const createWorldPointFromPointer = (event: CanvasPointerEvent<HTMLCanvasElement>) => {
    const worldPoint = screenToWorldPoint(
      getScreenPointFromClient(event.clientX, event.clientY),
      viewportRef.current,
      canvasSize.width,
      canvasSize.height
    )

    return {
      ...worldPoint,
      pressure: event.pointerType === 'pen' ? clamp(event.pressure || 0.08, 0.02, 1) : 1,
      tiltX: event.pointerType === 'pen' ? event.tiltX ?? 0 : 0,
      tiltY: event.pointerType === 'pen' ? event.tiltY ?? 0 : 0
    } satisfies Point
  }

  const beginViewPan = (pointerId: number, clientX: number, clientY: number) => {
    viewPanRef.current = {
      pointerId,
      origin: getScreenPointFromClient(clientX, clientY),
      viewport: viewportRef.current
    }
  }

  const beginTouchGesture = () => {
    if (touchPointersRef.current.size < 2 || canvasSize.width <= 1 || canvasSize.height <= 1) {
      return
    }

    const [firstEntry, secondEntry] = [...touchPointersRef.current.entries()]
    const firstPoint = getScreenPointFromClient(firstEntry[1].clientX, firstEntry[1].clientY)
    const secondPoint = getScreenPointFromClient(secondEntry[1].clientX, secondEntry[1].clientY)
    const midpoint = {
      x: (firstPoint.x + secondPoint.x) / 2,
      y: (firstPoint.y + secondPoint.y) / 2
    }

    gestureRef.current = {
      pointerIds: [firstEntry[0], secondEntry[0]],
      viewport: viewportRef.current,
      distance: Math.max(18, distanceBetween(firstPoint, secondPoint)),
      angle: Math.atan2(secondPoint.y - firstPoint.y, secondPoint.x - firstPoint.x),
      worldMidpoint: screenToWorldPoint(
        midpoint,
        viewportRef.current,
        canvasSize.width,
        canvasSize.height
      )
    }
    viewPanRef.current = null
  }

  const syncTouchNavigationAfterPointerExit = () => {
    if (touchPointersRef.current.size >= 2) {
      beginTouchGesture()
      return
    }

    gestureRef.current = null

    if (touchPointersRef.current.size === 1) {
      const [pointerId, pointer] = [...touchPointersRef.current.entries()][0]
      beginViewPan(pointerId, pointer.clientX, pointer.clientY)
      return
    }

    viewPanRef.current = null
  }

  useEffect(() => {
    rawPointsRef.current = rawPoints
  }, [rawPoints])

  useEffect(() => {
    const shell = shellRef.current

    if (!shell) {
      return
    }

    const resizeCanvas = () => {
      const rect = shell.getBoundingClientRect()
      const nextWidth = Math.max(1, Math.round(rect.width))
      const nextHeight = Math.max(1, Math.round(rect.height))
      const nextPixelRatio =
        typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2)

      setCanvasSize((currentSize) => {
        if (
          currentSize.width === nextWidth &&
          currentSize.height === nextHeight &&
          currentSize.pixelRatio === nextPixelRatio
        ) {
          return currentSize
        }

        return {
          width: nextWidth,
          height: nextHeight,
          pixelRatio: nextPixelRatio
        }
      })
    }

    const observer = new ResizeObserver(resizeCanvas)
    observer.observe(shell)
    resizeCanvas()

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const pixelWidth = Math.max(1, Math.round(canvasSize.width * canvasSize.pixelRatio))
    const pixelHeight = Math.max(1, Math.round(canvasSize.height * canvasSize.pixelRatio))

    if (canvas.width !== pixelWidth) {
      canvas.width = pixelWidth
    }

    if (canvas.height !== pixelHeight) {
      canvas.height = pixelHeight
    }

    if (!initializedViewRef.current && canvasSize.width > 1 && canvasSize.height > 1) {
      initializedViewRef.current = true
      resetViewToFit()
    }
  }, [canvasSize.height, canvasSize.pixelRatio, canvasSize.width])

  useEffect(() => {
    if (!initializedViewRef.current) {
      return
    }

    resetViewToFit()
  }, [viewResetToken])

  useEffect(() => {
    if (!canvasRef.current || canvasSize.width <= 1 || canvasSize.height <= 1) {
      return
    }

    const context = canvasRef.current.getContext('2d')

    if (!context) {
      return
    }

    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    context.scale(canvasSize.pixelRatio, canvasSize.pixelRatio)

    paintEditorScene(context, {
      currentFrame,
      previousFrame,
      previewStroke,
      previewLayerId: activeLayerId,
      selectedStrokeIds,
      activeLayerId,
      selectionRect,
      showOnionSkin: onionSkinEnabled && !isPlaying,
      onionSkinOpacity,
      viewport,
      viewportWidth: canvasSize.width,
      viewportHeight: canvasSize.height
    })
  }, [
    activeLayerId,
    canvasSize.height,
    canvasSize.pixelRatio,
    canvasSize.width,
    currentFrame,
    onionSkinEnabled,
    onionSkinOpacity,
    isPlaying,
    previousFrame,
    previewStroke,
    selectedStrokeIds,
    selectionRect,
    viewport
  ])

  useEffect(() => {
    resetLocalInteraction()
    clearNavigationState()
  }, [activeLayerId, activeTool, currentFrameIndex, isPlaying])

  const finishDrawing = (event?: CanvasPointerEvent<HTMLCanvasElement>) => {
    if (interactionRef.current !== 'drawing') {
      return
    }

    if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const finalPoint = event ? createWorldPointFromPointer(event) : null
    const completedPoints = finalPoint
      ? appendPoint(rawPointsRef.current, finalPoint, 0.1)
      : rawPointsRef.current

    const stroke = createStrokeFromRawPoints(completedPoints, brushForStroke, activeStrokeMode)

    if (stroke) {
      addStrokeToCurrentLayer(stroke)
    }

    resetLocalInteraction()
  }

  const finishSelection = (event?: CanvasPointerEvent<HTMLCanvasElement>) => {
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const finalPoint = event ? createWorldPointFromPointer(event) : pointerOriginRef.current

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

  const handlePointerDown = (event: CanvasPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'pen') {
      notePenActivity(event.pointerId, true)
    }

    if (isPlaying) {
      stopPlayback()
    }

    if (event.pointerType === 'touch') {
      if (shouldRejectTouchForPalm() || interactionRef.current !== 'idle') {
        return
      }

      event.currentTarget.setPointerCapture(event.pointerId)
      touchPointersRef.current.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY
      })

      if (touchPointersRef.current.size >= 2) {
        beginTouchGesture()
      } else {
        beginViewPan(event.pointerId, event.clientX, event.clientY)
      }

      return
    }

    if (event.pointerType === 'mouse' && (event.button === 1 || event.altKey)) {
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      beginViewPan(event.pointerId, event.clientX, event.clientY)
      return
    }

    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    if (event.pointerType === 'pen' && event.button > 0) {
      return
    }

    const point = createWorldPointFromPointer(event)

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

  const handlePointerMove = (event: CanvasPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'pen') {
      notePenActivity(event.pointerId, true)
    }

    if (event.pointerType === 'touch' && touchPointersRef.current.has(event.pointerId)) {
      touchPointersRef.current.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY
      })
    }

    if (
      gestureRef.current &&
      gestureRef.current.pointerIds.includes(event.pointerId) &&
      touchPointersRef.current.size >= 2
    ) {
      const firstPointer = touchPointersRef.current.get(gestureRef.current.pointerIds[0])
      const secondPointer = touchPointersRef.current.get(gestureRef.current.pointerIds[1])

      if (!firstPointer || !secondPointer) {
        return
      }

      const firstScreenPoint = getScreenPointFromClient(firstPointer.clientX, firstPointer.clientY)
      const secondScreenPoint = getScreenPointFromClient(
        secondPointer.clientX,
        secondPointer.clientY
      )
      const midpoint = {
        x: (firstScreenPoint.x + secondScreenPoint.x) / 2,
        y: (firstScreenPoint.y + secondScreenPoint.y) / 2
      }
      const nextDistance = Math.max(18, distanceBetween(firstScreenPoint, secondScreenPoint))
      const nextAngle = Math.atan2(
        secondScreenPoint.y - firstScreenPoint.y,
        secondScreenPoint.x - firstScreenPoint.x
      )
      const nextScale = clamp(
        gestureRef.current.viewport.scale * (nextDistance / gestureRef.current.distance),
        MIN_VIEW_SCALE,
        MAX_VIEW_SCALE
      )
      const nextRotation = normalizeAngle(
        gestureRef.current.viewport.rotation + (nextAngle - gestureRef.current.angle)
      )
      const anchoredOffset = getViewportOffsetForAnchor(
        gestureRef.current.worldMidpoint,
        midpoint,
        canvasSize.width,
        canvasSize.height,
        nextScale,
        nextRotation
      )

      updateViewport({
        scale: nextScale,
        rotation: nextRotation,
        offsetX: anchoredOffset.offsetX,
        offsetY: anchoredOffset.offsetY
      })
      return
    }

    if (viewPanRef.current?.pointerId === event.pointerId) {
      const currentScreenPoint = getScreenPointFromClient(event.clientX, event.clientY)
      const deltaX = currentScreenPoint.x - viewPanRef.current.origin.x
      const deltaY = currentScreenPoint.y - viewPanRef.current.origin.y

      updateViewport({
        ...viewPanRef.current.viewport,
        offsetX: viewPanRef.current.viewport.offsetX + deltaX,
        offsetY: viewPanRef.current.viewport.offsetY + deltaY
      })
      return
    }

    const point = createWorldPointFromPointer(event)

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

  const handlePointerUp = (event: CanvasPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'pen') {
      notePenActivity(event.pointerId, false)
    }

    if (event.pointerType === 'touch') {
      touchPointersRef.current.delete(event.pointerId)

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      if (gestureRef.current?.pointerIds.includes(event.pointerId) || viewPanRef.current) {
        syncTouchNavigationAfterPointerExit()
      }

      return
    }

    if (viewPanRef.current?.pointerId === event.pointerId) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      viewPanRef.current = null
      return
    }

    if (interactionRef.current === 'drawing') {
      finishDrawing(event)
      return
    }

    finishSelection(event)
  }

  const handlePointerCancel = (event: CanvasPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'pen') {
      notePenActivity(event.pointerId, false)
    }

    if (event.pointerType === 'touch') {
      touchPointersRef.current.delete(event.pointerId)

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      syncTouchNavigationAfterPointerExit()
      return
    }

    if (viewPanRef.current?.pointerId === event.pointerId) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      viewPanRef.current = null
      return
    }

    if (interactionRef.current === 'drawing') {
      finishDrawing(event)
      return
    }

    finishSelection(event)
  }

  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault()

    const screenPoint = getScreenPointFromClient(event.clientX, event.clientY)

    if (event.altKey) {
      const worldAnchor = screenToWorldPoint(
        screenPoint,
        viewportRef.current,
        canvasSize.width,
        canvasSize.height
      )
      const nextRotation = normalizeAngle(viewportRef.current.rotation - event.deltaY * 0.008)
      const anchoredOffset = getViewportOffsetForAnchor(
        worldAnchor,
        screenPoint,
        canvasSize.width,
        canvasSize.height,
        viewportRef.current.scale,
        nextRotation
      )

      updateViewport({
        ...viewportRef.current,
        rotation: nextRotation,
        offsetX: anchoredOffset.offsetX,
        offsetY: anchoredOffset.offsetY
      })
      return
    }

    if (event.ctrlKey || event.metaKey) {
      const worldAnchor = screenToWorldPoint(
        screenPoint,
        viewportRef.current,
        canvasSize.width,
        canvasSize.height
      )
      const nextScale = clamp(
        viewportRef.current.scale * Math.exp(-event.deltaY * 0.0022),
        MIN_VIEW_SCALE,
        MAX_VIEW_SCALE
      )
      const anchoredOffset = getViewportOffsetForAnchor(
        worldAnchor,
        screenPoint,
        canvasSize.width,
        canvasSize.height,
        nextScale,
        viewportRef.current.rotation
      )

      updateViewport({
        ...viewportRef.current,
        scale: nextScale,
        offsetX: anchoredOffset.offsetX,
        offsetY: anchoredOffset.offsetY
      })
      return
    }

    updateViewport((currentViewport) => ({
      ...currentViewport,
      offsetX: currentViewport.offsetX - event.deltaX,
      offsetY: currentViewport.offsetY - event.deltaY
    }))
  }

  const rotationDegrees = Math.round((viewport.rotation * 180) / Math.PI)

  return (
    <section className="canvas-stage">
      <div
        ref={shellRef}
        className={`canvas-shell ${isFullscreen ? 'canvas-shell-fullscreen' : ''}`}
      >
        <div className="canvas-overlay">
          <div className="canvas-overlay-group">
            <div className="canvas-badge">
              {isPlaying ? `Playing ${fps} FPS` : activeTool.toUpperCase()}
            </div>
            <div className="canvas-badge">
              {activeLayer?.locked ? 'Locked Layer' : activeLayer?.name ?? 'No Layer'}
            </div>
            <div className="canvas-badge">
              View {Math.round(viewport.scale * 100)}%
              {rotationDegrees !== 0 ? ` / ${rotationDegrees} deg` : ''}
            </div>
          </div>

          <div className="canvas-overlay-group">
            <div className="canvas-badge">
              Frame {currentFrameIndex + 1} of {frames.length}
            </div>
            <div className="canvas-badge">{selectedStrokeIds.length} selected</div>
            <div className="canvas-badge canvas-badge-help">
              Pencil uses pressure and tilt. Touch navigates. Palm touch is ignored while pen is down.
            </div>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          className={`drawing-canvas ${activeTool === 'select' ? 'drawing-canvas-select' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onWheel={handleWheel}
        />

        <div className="canvas-frame-guide">
          <span>
            Stage {CANVAS_WIDTH} x {CANVAS_HEIGHT}
          </span>
        </div>
      </div>
    </section>
  )
}
