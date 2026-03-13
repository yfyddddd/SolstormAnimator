import { create } from 'zustand'
import { cloneFrame, cloneFrames, cloneLayer, cloneStroke, createId } from '../lib/compat'
import { clamp, getLayerById, getSelectionBounds } from '../lib/drawing'
import type { BrushSettings, Frame, Layer, Point, Stroke, Tool } from '../types'

type DocumentSnapshot = {
  frames: Frame[]
  currentFrameIndex: number
  activeLayerId: string
  selectedStrokeIds: string[]
  playbackTick: number
}

type ProjectState = {
  frames: Frame[]
  currentFrameIndex: number
  activeLayerId: string
  selectedStrokeIds: string[]
  activeTool: Tool
  brush: BrushSettings
  isPlaying: boolean
  fps: number
  playbackTick: number
  onionSkinEnabled: boolean
  onionSkinOpacity: number
  history: DocumentSnapshot[]
  future: DocumentSnapshot[]
  updateBrush: (partial: Partial<BrushSettings>) => void
  setActiveTool: (tool: Tool) => void
  setFps: (fps: number) => void
  setOnionSkinEnabled: (enabled: boolean) => void
  setOnionSkinOpacity: (opacity: number) => void
  setPlaying: (playing: boolean) => void
  togglePlayback: () => void
  stopPlayback: () => void
  advancePlayback: () => void
  undo: () => void
  redo: () => void
  pushHistoryCheckpoint: () => void
  selectFrame: (index: number) => void
  stepFrame: (delta: number) => void
  setCurrentFrameExposure: (exposure: number) => void
  addFrame: () => void
  duplicateCurrentFrame: () => void
  deleteCurrentFrame: () => void
  clearCurrentFrame: () => void
  selectLayer: (layerId: string) => void
  addLayer: () => void
  duplicateActiveLayer: () => void
  deleteActiveLayer: () => void
  toggleLayerVisibility: (layerId: string) => void
  toggleLayerLock: (layerId: string) => void
  setLayerOpacity: (layerId: string, opacity: number) => void
  addStrokeToCurrentLayer: (stroke: Stroke) => void
  setSelectedStrokeIds: (strokeIds: string[]) => void
  clearSelection: () => void
  deleteSelectedStrokes: () => void
  translateSelectedStrokes: (dx: number, dy: number, recordHistory?: boolean) => void
  rotateSelectedStrokes: (degrees: number, recordHistory?: boolean) => void
  scaleSelectedStrokes: (
    scaleX: number,
    scaleY: number,
    recordHistory?: boolean
  ) => void
  flipSelectedStrokes: (axis: 'horizontal' | 'vertical') => void
}

type LayerTemplate = Omit<Layer, 'strokes'>

const HISTORY_LIMIT = 80

const createLayerTemplate = (name: string): LayerTemplate => ({
  id: createId(),
  name,
  visible: true,
  locked: false,
  opacity: 1
})

const createLayerFromTemplate = (template: LayerTemplate): Layer => ({
  ...template,
  strokes: []
})

const createFrameFromTemplates = (templates: LayerTemplate[]): Frame => ({
  id: createId(),
  exposure: 1,
  layers: templates.map((template) => createLayerFromTemplate(template))
})

const extractLayerTemplates = (frame: Frame): LayerTemplate[] =>
  frame.layers.map(({ id, name, visible, locked, opacity }) => ({
    id,
    name,
    visible,
    locked,
    opacity
  }))

const cloneStrokeWithNewId = (stroke: Stroke): Stroke => ({
  ...cloneStroke(stroke),
  id: createId()
})

const duplicateFrameWithNewStrokeIds = (frame: Frame): Frame => ({
  ...cloneFrame(frame),
  id: createId(),
  layers: frame.layers.map((layer) => ({
    ...cloneLayer(layer),
    strokes: layer.strokes.map(cloneStrokeWithNewId)
  }))
})

const duplicateLayerWithNewStrokeIds = (layer: Layer, layerId: string, layerName: string): Layer => ({
  ...cloneLayer(layer),
  id: layerId,
  name: layerName,
  strokes: layer.strokes.map(cloneStrokeWithNewId)
})

const getCurrentFrame = (state: ProjectState) => state.frames[state.currentFrameIndex]

const getSafeActiveLayerId = (frame: Frame, candidateLayerId: string) =>
  frame.layers.some((layer) => layer.id === candidateLayerId)
    ? candidateLayerId
    : frame.layers[0]?.id ?? candidateLayerId

const createSnapshot = (state: ProjectState): DocumentSnapshot => ({
  frames: cloneFrames(state.frames),
  currentFrameIndex: state.currentFrameIndex,
  activeLayerId: state.activeLayerId,
  selectedStrokeIds: [...state.selectedStrokeIds],
  playbackTick: state.playbackTick
})

const appendHistory = (history: DocumentSnapshot[], snapshot: DocumentSnapshot) =>
  [...history, snapshot].slice(-HISTORY_LIMIT)

const initialLayer = createLayerTemplate('Layer 1')
const initialFrame = createFrameFromTemplates([initialLayer])

const initialBrush: BrushSettings = {
  color: '#ffffff',
  size: 6,
  opacity: 1,
  taper: 22,
  stabilization: 34
}

export const useProjectStore = create<ProjectState>((set, get) => {
  const applyMutation = (
    recipe: (state: ProjectState) => Partial<ProjectState> | null,
    options?: { recordHistory?: boolean }
  ) => {
    set((state) => {
      const result = recipe(state)

      if (!result) {
        return {}
      }

      if (options?.recordHistory === false) {
        return result
      }

      return {
        ...result,
        history: appendHistory(state.history, createSnapshot(state)),
        future: []
      }
    })
  }

  const transformSelectedStrokes = (
    transformer: (stroke: Stroke, center: Point) => Stroke,
    recordHistory = true
  ) => {
    applyMutation(
      (state) => {
        if (state.selectedStrokeIds.length === 0) {
          return null
        }

        const currentFrame = getCurrentFrame(state)
        const activeLayer = getLayerById(currentFrame, state.activeLayerId)

        if (!activeLayer || activeLayer.locked) {
          return null
        }

        const selectedSet = new Set(state.selectedStrokeIds)
        const selectedStrokes = activeLayer.strokes.filter((stroke) => selectedSet.has(stroke.id))
        const selectionBounds = getSelectionBounds(selectedStrokes)

        if (!selectionBounds) {
          return null
        }

        const frames = state.frames.map((frame, frameIndex) =>
          frameIndex !== state.currentFrameIndex
            ? frame
            : {
                ...frame,
                layers: frame.layers.map((layer) =>
                  layer.id !== state.activeLayerId
                    ? layer
                    : {
                        ...layer,
                        strokes: layer.strokes.map((stroke) =>
                          selectedSet.has(stroke.id)
                            ? transformer(stroke, selectionBounds.center)
                            : stroke
                        )
                      }
                )
              }
        )

        return {
          frames,
          isPlaying: false,
          playbackTick: 0
        }
      },
      { recordHistory }
    )
  }

  return {
    frames: [initialFrame],
    currentFrameIndex: 0,
    activeLayerId: initialLayer.id,
    selectedStrokeIds: [],
    activeTool: 'brush',
    brush: initialBrush,
    isPlaying: false,
    fps: 8,
    playbackTick: 0,
    onionSkinEnabled: true,
    onionSkinOpacity: 0.18,
    history: [],
    future: [],
    updateBrush: (partial) =>
      set((state) => ({
        brush: {
          ...state.brush,
          ...partial
        }
      })),
    setActiveTool: (tool) =>
      set({
        activeTool: tool
      }),
    setFps: (fps) =>
      set({
        fps: clamp(Math.round(fps), 1, 24)
      }),
    setOnionSkinEnabled: (enabled) =>
      set({
        onionSkinEnabled: enabled
      }),
    setOnionSkinOpacity: (opacity) =>
      set({
        onionSkinOpacity: clamp(opacity, 0, 0.8)
      }),
    setPlaying: (playing) =>
      set({
        isPlaying: playing,
        playbackTick: 0,
        selectedStrokeIds: playing ? [] : get().selectedStrokeIds
      }),
    togglePlayback: () =>
      set((state) => ({
        isPlaying: !state.isPlaying,
        playbackTick: 0,
        selectedStrokeIds: !state.isPlaying ? [] : state.selectedStrokeIds
      })),
    stopPlayback: () =>
      set({
        isPlaying: false,
        playbackTick: 0
      }),
    advancePlayback: () =>
      set((state) => {
        const currentFrame = getCurrentFrame(state)
        const nextTick = state.playbackTick + 1

        if (nextTick < currentFrame.exposure) {
          return {
            playbackTick: nextTick
          }
        }

        return {
          currentFrameIndex:
            state.frames.length <= 1 ? 0 : (state.currentFrameIndex + 1) % state.frames.length,
          playbackTick: 0
        }
      }),
    undo: () =>
      set((state) => {
        const snapshot = state.history[state.history.length - 1]

        if (!snapshot) {
          return {}
        }

        const targetFrame = snapshot.frames[snapshot.currentFrameIndex]
        const activeLayerId = getSafeActiveLayerId(targetFrame, snapshot.activeLayerId)

        return {
          frames: cloneFrames(snapshot.frames),
          currentFrameIndex: snapshot.currentFrameIndex,
          activeLayerId,
          selectedStrokeIds: [...snapshot.selectedStrokeIds],
          playbackTick: snapshot.playbackTick,
          isPlaying: false,
          history: state.history.slice(0, -1),
          future: appendHistory(state.future, createSnapshot(state))
        }
      }),
    redo: () =>
      set((state) => {
        const snapshot = state.future[state.future.length - 1]

        if (!snapshot) {
          return {}
        }

        const targetFrame = snapshot.frames[snapshot.currentFrameIndex]
        const activeLayerId = getSafeActiveLayerId(targetFrame, snapshot.activeLayerId)

        return {
          frames: cloneFrames(snapshot.frames),
          currentFrameIndex: snapshot.currentFrameIndex,
          activeLayerId,
          selectedStrokeIds: [...snapshot.selectedStrokeIds],
          playbackTick: snapshot.playbackTick,
          isPlaying: false,
          history: appendHistory(state.history, createSnapshot(state)),
          future: state.future.slice(0, -1)
        }
      }),
    pushHistoryCheckpoint: () =>
      set((state) => ({
        history: appendHistory(state.history, createSnapshot(state)),
        future: []
      })),
    selectFrame: (index) =>
      set((state) => {
        const currentFrameIndex = clamp(index, 0, state.frames.length - 1)
        const targetFrame = state.frames[currentFrameIndex]

        return {
          currentFrameIndex,
          activeLayerId: getSafeActiveLayerId(targetFrame, state.activeLayerId),
          selectedStrokeIds: [],
          isPlaying: false,
          playbackTick: 0
        }
      }),
    stepFrame: (delta) =>
      set((state) => {
        const currentFrameIndex = clamp(
          state.currentFrameIndex + delta,
          0,
          state.frames.length - 1
        )
        const targetFrame = state.frames[currentFrameIndex]

        return {
          currentFrameIndex,
          activeLayerId: getSafeActiveLayerId(targetFrame, state.activeLayerId),
          selectedStrokeIds: [],
          isPlaying: false,
          playbackTick: 0
        }
      }),
    setCurrentFrameExposure: (exposure) =>
      applyMutation((state) => ({
        frames: state.frames.map((frame, index) =>
          index === state.currentFrameIndex
            ? {
                ...frame,
                exposure: clamp(Math.round(exposure), 1, 12)
              }
            : frame
        ),
        isPlaying: false,
        playbackTick: 0
      })),
    addFrame: () =>
      applyMutation((state) => {
        const templates = extractLayerTemplates(getCurrentFrame(state))
        const nextFrame = createFrameFromTemplates(templates)
        const insertIndex = state.currentFrameIndex + 1

        return {
          frames: [
            ...state.frames.slice(0, insertIndex),
            nextFrame,
            ...state.frames.slice(insertIndex)
          ],
          currentFrameIndex: insertIndex,
          activeLayerId: getSafeActiveLayerId(nextFrame, state.activeLayerId),
          selectedStrokeIds: [],
          isPlaying: false,
          playbackTick: 0
        }
      }),
    duplicateCurrentFrame: () =>
      applyMutation((state) => {
        const duplicatedFrame = duplicateFrameWithNewStrokeIds(getCurrentFrame(state))
        const insertIndex = state.currentFrameIndex + 1

        return {
          frames: [
            ...state.frames.slice(0, insertIndex),
            duplicatedFrame,
            ...state.frames.slice(insertIndex)
          ],
          currentFrameIndex: insertIndex,
          activeLayerId: getSafeActiveLayerId(duplicatedFrame, state.activeLayerId),
          selectedStrokeIds: [],
          isPlaying: false,
          playbackTick: 0
        }
      }),
    deleteCurrentFrame: () =>
      applyMutation((state) => {
        if (state.frames.length === 1) {
          return {
            frames: state.frames.map((frame) => ({
              ...frame,
              exposure: 1,
              layers: frame.layers.map((layer) => ({
                ...layer,
                strokes: []
              }))
            })),
            selectedStrokeIds: [],
            isPlaying: false,
            playbackTick: 0
          }
        }

        const frames = state.frames.filter((_, index) => index !== state.currentFrameIndex)
        const currentFrameIndex = Math.min(state.currentFrameIndex, frames.length - 1)
        const targetFrame = frames[currentFrameIndex]

        return {
          frames,
          currentFrameIndex,
          activeLayerId: getSafeActiveLayerId(targetFrame, state.activeLayerId),
          selectedStrokeIds: [],
          isPlaying: false,
          playbackTick: 0
        }
      }),
    clearCurrentFrame: () =>
      applyMutation((state) => ({
        frames: state.frames.map((frame, index) =>
          index !== state.currentFrameIndex
            ? frame
            : {
                ...frame,
                layers: frame.layers.map((layer) => ({
                  ...layer,
                  strokes: []
                }))
              }
        ),
        selectedStrokeIds: [],
        isPlaying: false,
        playbackTick: 0
      })),
    selectLayer: (layerId) =>
      set((state) => {
        const currentFrame = getCurrentFrame(state)

        if (!currentFrame.layers.some((layer) => layer.id === layerId)) {
          return {}
        }

        return {
          activeLayerId: layerId,
          selectedStrokeIds: [],
          isPlaying: false,
          playbackTick: 0
        }
      }),
    addLayer: () =>
      applyMutation((state) => {
        const layerName = `Layer ${getCurrentFrame(state).layers.length + 1}`
        const template = createLayerTemplate(layerName)

        return {
          frames: state.frames.map((frame) => ({
            ...frame,
            layers: [...frame.layers, createLayerFromTemplate(template)]
          })),
          activeLayerId: template.id,
          selectedStrokeIds: []
        }
      }),
    duplicateActiveLayer: () =>
      applyMutation((state) => {
        const currentFrame = getCurrentFrame(state)
        const activeIndex = currentFrame.layers.findIndex(
          (layer) => layer.id === state.activeLayerId
        )

        if (activeIndex === -1) {
          return null
        }

        const newLayerId = createId()
        const baseLayer = currentFrame.layers[activeIndex]
        const newLayerName = `${baseLayer.name} copy`

        return {
          frames: state.frames.map((frame) => ({
            ...frame,
            layers: frame.layers.flatMap((layer, layerIndex) =>
              layerIndex !== activeIndex
                ? [layer]
                : [
                    layer,
                    duplicateLayerWithNewStrokeIds(layer, newLayerId, newLayerName)
                  ]
            )
          })),
          activeLayerId: newLayerId,
          selectedStrokeIds: []
        }
      }),
    deleteActiveLayer: () =>
      applyMutation((state) => {
        const currentFrame = getCurrentFrame(state)

        if (currentFrame.layers.length === 1) {
          return {
            frames: state.frames.map((frame) => ({
              ...frame,
              layers: frame.layers.map((layer) => ({
                ...layer,
                strokes: []
              }))
            })),
            selectedStrokeIds: []
          }
        }

        const activeIndex = currentFrame.layers.findIndex(
          (layer) => layer.id === state.activeLayerId
        )
        const fallbackLayer =
          currentFrame.layers[activeIndex === 0 ? 1 : activeIndex - 1] ??
          currentFrame.layers[0]

        return {
          frames: state.frames.map((frame) => ({
            ...frame,
            layers: frame.layers.filter((layer) => layer.id !== state.activeLayerId)
          })),
          activeLayerId: fallbackLayer.id,
          selectedStrokeIds: []
        }
      }),
    toggleLayerVisibility: (layerId) =>
      applyMutation((state) => ({
        frames: state.frames.map((frame) => ({
          ...frame,
          layers: frame.layers.map((layer) =>
            layer.id === layerId
              ? {
                  ...layer,
                  visible: !layer.visible
                }
              : layer
          )
        })),
        selectedStrokeIds: state.activeLayerId === layerId ? [] : state.selectedStrokeIds
      })),
    toggleLayerLock: (layerId) =>
      applyMutation((state) => ({
        frames: state.frames.map((frame) => ({
          ...frame,
          layers: frame.layers.map((layer) =>
            layer.id === layerId
              ? {
                  ...layer,
                  locked: !layer.locked
                }
              : layer
          )
        })),
        selectedStrokeIds: state.activeLayerId === layerId ? [] : state.selectedStrokeIds
      })),
    setLayerOpacity: (layerId, opacity) =>
      applyMutation((state) => ({
        frames: state.frames.map((frame) => ({
          ...frame,
          layers: frame.layers.map((layer) =>
            layer.id === layerId
              ? {
                  ...layer,
                  opacity: clamp(opacity, 0.05, 1)
                }
              : layer
          )
        }))
      })),
    addStrokeToCurrentLayer: (stroke) =>
      applyMutation((state) => {
        const currentFrame = getCurrentFrame(state)
        const activeLayer = getLayerById(currentFrame, state.activeLayerId)

        if (!activeLayer || activeLayer.locked) {
          return null
        }

        return {
          frames: state.frames.map((frame, frameIndex) =>
            frameIndex !== state.currentFrameIndex
              ? frame
              : {
                  ...frame,
                  layers: frame.layers.map((layer) =>
                    layer.id !== state.activeLayerId
                      ? layer
                      : {
                          ...layer,
                          strokes: [...layer.strokes, stroke]
                        }
                  )
                }
          ),
          selectedStrokeIds: []
        }
      }),
    setSelectedStrokeIds: (strokeIds) =>
      set({
        selectedStrokeIds: [...strokeIds]
      }),
    clearSelection: () =>
      set({
        selectedStrokeIds: []
      }),
    deleteSelectedStrokes: () =>
      applyMutation((state) => {
        if (state.selectedStrokeIds.length === 0) {
          return null
        }

        const activeLayer = getLayerById(getCurrentFrame(state), state.activeLayerId)

        if (!activeLayer || activeLayer.locked) {
          return null
        }

        const selectedSet = new Set(state.selectedStrokeIds)

        return {
          frames: state.frames.map((frame, frameIndex) =>
            frameIndex !== state.currentFrameIndex
              ? frame
              : {
                  ...frame,
                  layers: frame.layers.map((layer) =>
                    layer.id !== state.activeLayerId
                      ? layer
                      : {
                          ...layer,
                          strokes: layer.strokes.filter((stroke) => !selectedSet.has(stroke.id))
                        }
                  )
                }
          ),
          selectedStrokeIds: []
        }
      }),
    translateSelectedStrokes: (dx, dy, recordHistory = true) =>
      transformSelectedStrokes(
        (stroke) => ({
          ...stroke,
          points: stroke.points.map((point) => ({
            x: point.x + dx,
            y: point.y + dy
          }))
        }),
        recordHistory
      ),
    rotateSelectedStrokes: (degrees, recordHistory = true) => {
      const radians = (degrees * Math.PI) / 180

      transformSelectedStrokes(
        (stroke, center) => ({
          ...stroke,
          points: stroke.points.map((point) => {
            const offsetX = point.x - center.x
            const offsetY = point.y - center.y

            return {
              x: center.x + offsetX * Math.cos(radians) - offsetY * Math.sin(radians),
              y: center.y + offsetX * Math.sin(radians) + offsetY * Math.cos(radians)
            }
          })
        }),
        recordHistory
      )
    },
    scaleSelectedStrokes: (scaleX, scaleY, recordHistory = true) =>
      transformSelectedStrokes(
        (stroke, center) => {
          const sizeScale = (Math.abs(scaleX) + Math.abs(scaleY)) / 2

          return {
            ...stroke,
            size: Math.max(1, stroke.size * sizeScale),
            points: stroke.points.map((point) => ({
              x: center.x + (point.x - center.x) * scaleX,
              y: center.y + (point.y - center.y) * scaleY
            }))
          }
        },
        recordHistory
      ),
    flipSelectedStrokes: (axis) =>
      transformSelectedStrokes((stroke, center) => ({
        ...stroke,
        points: stroke.points.map((point) => ({
          x: axis === 'horizontal' ? center.x - (point.x - center.x) : point.x,
          y: axis === 'vertical' ? center.y - (point.y - center.y) : point.y
        }))
      }))
  }
})
