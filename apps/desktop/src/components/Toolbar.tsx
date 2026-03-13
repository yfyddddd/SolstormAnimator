import { countFrameStrokes } from '../lib/drawing'
import { useProjectStore } from '../state/projectStore'
import type { Tool } from '../types'

type ToolbarProps = {
  isFullscreen: boolean
  onToggleFullscreen: () => void
}

const tools: { id: Tool; label: string; shortcut: string }[] = [
  { id: 'brush', label: 'Brush', shortcut: 'B' },
  { id: 'eraser', label: 'Eraser', shortcut: 'E' },
  { id: 'select', label: 'Select', shortcut: 'V' }
]

export function Toolbar({ isFullscreen, onToggleFullscreen }: ToolbarProps) {
  const frames = useProjectStore((state) => state.frames)
  const currentFrameIndex = useProjectStore((state) => state.currentFrameIndex)
  const activeLayerId = useProjectStore((state) => state.activeLayerId)
  const activeTool = useProjectStore((state) => state.activeTool)
  const selectedStrokeIds = useProjectStore((state) => state.selectedStrokeIds)
  const isPlaying = useProjectStore((state) => state.isPlaying)
  const fps = useProjectStore((state) => state.fps)
  const canUndo = useProjectStore((state) => state.history.length > 0)
  const canRedo = useProjectStore((state) => state.future.length > 0)
  const undo = useProjectStore((state) => state.undo)
  const redo = useProjectStore((state) => state.redo)
  const stepFrame = useProjectStore((state) => state.stepFrame)
  const togglePlayback = useProjectStore((state) => state.togglePlayback)
  const addFrame = useProjectStore((state) => state.addFrame)
  const duplicateCurrentFrame = useProjectStore((state) => state.duplicateCurrentFrame)
  const deleteCurrentFrame = useProjectStore((state) => state.deleteCurrentFrame)
  const clearCurrentFrame = useProjectStore((state) => state.clearCurrentFrame)
  const setActiveTool = useProjectStore((state) => state.setActiveTool)
  const setFps = useProjectStore((state) => state.setFps)

  const currentFrame = frames[currentFrameIndex] ?? frames[0]
  const activeLayer =
    currentFrame.layers.find((layer) => layer.id === activeLayerId) ?? currentFrame.layers[0]

  return (
    <section className="toolbar-panel">
      <div className="toolbar-group">
        <button onClick={undo} disabled={!canUndo}>
          Undo
        </button>
        <button onClick={redo} disabled={!canRedo}>
          Redo
        </button>
        <button onClick={() => stepFrame(-1)} disabled={currentFrameIndex === 0}>
          Previous
        </button>
        <button onClick={() => stepFrame(1)} disabled={currentFrameIndex === frames.length - 1}>
          Next
        </button>
        <button className="button-accent" onClick={togglePlayback}>
          {isPlaying ? 'Pause Playback' : 'Play Animation'}
        </button>
      </div>

      <div className="toolbar-group">
        {tools.map((tool) => (
          <button
            key={tool.id}
            className={`tool-toggle ${activeTool === tool.id ? 'tool-toggle-active' : ''}`}
            onClick={() => setActiveTool(tool.id)}
          >
            {tool.label}
            <span>{tool.shortcut}</span>
          </button>
        ))}
      </div>

      <div className="toolbar-group">
        <button onClick={addFrame}>New Frame</button>
        <button onClick={duplicateCurrentFrame}>Duplicate</button>
        <button onClick={deleteCurrentFrame}>Delete Frame</button>
        <button onClick={clearCurrentFrame}>Clear Frame</button>
        <button onClick={onToggleFullscreen}>
          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </button>
      </div>

      <div className="toolbar-group toolbar-group-stretch">
        <label className="range-field compact-range-field">
          <span>Playback Speed</span>
          <div className="range-row">
            <input
              type="range"
              min="1"
              max="24"
              value={fps}
              onChange={(event) => setFps(Number(event.target.value))}
            />
            <strong>{fps} FPS</strong>
          </div>
        </label>
      </div>

      <div className="toolbar-group toolbar-status-group">
        <div className="status-pill">
          Frame {currentFrameIndex + 1} / {frames.length}
        </div>
        <div className="status-pill">Hold x{currentFrame.exposure}</div>
        <div className="status-pill">{currentFrame.layers.length} layers</div>
        <div className="status-pill">{countFrameStrokes(currentFrame)} strokes</div>
        <div className="status-pill">
          {activeLayer?.name ?? 'No Layer'} {selectedStrokeIds.length > 0 ? `(${selectedStrokeIds.length})` : ''}
        </div>
      </div>
    </section>
  )
}
