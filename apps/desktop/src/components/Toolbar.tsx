import { countFrameStrokes } from '../lib/drawing'
import { useProjectStore } from '../state/projectStore'

type ToolbarProps = {
  collapsed: boolean
  isFullscreen: boolean
  isLeftPanelOpen: boolean
  isRightPanelOpen: boolean
  isTimelineOpen: boolean
  onToggleFullscreen: () => void
  onResetView: () => void
  onToggleLeftPanel: () => void
  onToggleRightPanel: () => void
  onToggleTimeline: () => void
  onToggleCollapsed: () => void
}

export function Toolbar({
  collapsed,
  isFullscreen,
  isLeftPanelOpen,
  isRightPanelOpen,
  isTimelineOpen,
  onToggleFullscreen,
  onResetView,
  onToggleLeftPanel,
  onToggleRightPanel,
  onToggleTimeline,
  onToggleCollapsed
}: ToolbarProps) {
  const frames = useProjectStore((state) => state.frames)
  const currentFrameIndex = useProjectStore((state) => state.currentFrameIndex)
  const activeLayerId = useProjectStore((state) => state.activeLayerId)
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
  const setFps = useProjectStore((state) => state.setFps)

  const currentFrame = frames[currentFrameIndex] ?? frames[0]
  const activeLayer =
    currentFrame.layers.find((layer) => layer.id === activeLayerId) ?? currentFrame.layers[0]

  if (collapsed) {
    return (
      <section className="top-toolbar top-toolbar-collapsed">
        <div className="toolbar-brand">
          <span className="toolbar-badge">Solstorm Animator</span>
        </div>

        <div className="toolbar-group">
          <button className={isLeftPanelOpen ? 'button-accent' : ''} onClick={onToggleLeftPanel}>
            Brush
          </button>
          <button className={isRightPanelOpen ? 'button-accent' : ''} onClick={onToggleRightPanel}>
            Layers
          </button>
          <button className={isTimelineOpen ? 'button-accent' : ''} onClick={onToggleTimeline}>
            Timeline
          </button>
        </div>

        <div className="toolbar-group toolbar-group-end">
          <button className="button-accent" onClick={togglePlayback}>
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button onClick={onToggleCollapsed}>Expand</button>
        </div>
      </section>
    )
  }

  return (
    <section className="top-toolbar">
      <div className="toolbar-brand">
        <span className="toolbar-badge">Solstorm Animator</span>
        <p>Draw on the stage, pull controls in only when you need them.</p>
      </div>

      <div className="toolbar-group">
        <button className={isLeftPanelOpen ? 'button-accent' : ''} onClick={onToggleLeftPanel}>
          Brush Rail
        </button>
        <button className={isRightPanelOpen ? 'button-accent' : ''} onClick={onToggleRightPanel}>
          Layers Rail
        </button>
        <button className={isTimelineOpen ? 'button-accent' : ''} onClick={onToggleTimeline}>
          Timeline
        </button>
      </div>

      <div className="toolbar-group">
        <button onClick={undo} disabled={!canUndo}>
          Undo
        </button>
        <button onClick={redo} disabled={!canRedo}>
          Redo
        </button>
        <button onClick={() => stepFrame(-1)} disabled={currentFrameIndex === 0}>
          Prev
        </button>
        <button className="button-accent" onClick={togglePlayback}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button onClick={() => stepFrame(1)} disabled={currentFrameIndex === frames.length - 1}>
          Next
        </button>
        <button onClick={addFrame}>New</button>
        <button onClick={duplicateCurrentFrame}>Dupe</button>
      </div>

      <label className="toolbar-slider">
        <span>Playback</span>
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

      <div className="toolbar-group toolbar-group-end">
        <button onClick={onResetView}>Reset View</button>
        <button onClick={onToggleFullscreen}>
          {isFullscreen ? 'Windowed' : 'Fullscreen'}
        </button>
        <button onClick={onToggleCollapsed}>Minimize</button>
      </div>

      <div className="toolbar-status">
        <div className="status-pill">
          Frame {currentFrameIndex + 1} / {frames.length}
        </div>
        <div className="status-pill">Hold x{currentFrame.exposure}</div>
        <div className="status-pill">{currentFrame.layers.length} layers</div>
        <div className="status-pill">{countFrameStrokes(currentFrame)} strokes</div>
        <div className="status-pill">
          {activeLayer?.name ?? 'No Layer'} {selectedStrokeIds.length ? `(${selectedStrokeIds.length})` : ''}
        </div>
      </div>
    </section>
  )
}
