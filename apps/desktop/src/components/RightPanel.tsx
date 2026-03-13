import { countFrameStrokes } from '../lib/drawing'
import { useProjectStore } from '../state/projectStore'
import type { Tool } from '../types'

type SliderFieldProps = {
  label: string
  min: number
  max: number
  value: number
  displayValue: string
  onChange: (value: number) => void
  step?: number
}

const toolLabels: Record<Tool, string> = {
  brush: 'Brush',
  eraser: 'Eraser',
  select: 'Select'
}

function SliderField({
  label,
  min,
  max,
  value,
  displayValue,
  onChange,
  step = 1
}: SliderFieldProps) {
  return (
    <label className="range-field">
      <span>{label}</span>
      <div className="range-row">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <strong>{displayValue}</strong>
      </div>
    </label>
  )
}

export function RightPanel() {
  const frames = useProjectStore((state) => state.frames)
  const currentFrameIndex = useProjectStore((state) => state.currentFrameIndex)
  const activeLayerId = useProjectStore((state) => state.activeLayerId)
  const activeTool = useProjectStore((state) => state.activeTool)
  const brush = useProjectStore((state) => state.brush)
  const selectedStrokeIds = useProjectStore((state) => state.selectedStrokeIds)
  const onionSkinEnabled = useProjectStore((state) => state.onionSkinEnabled)
  const onionSkinOpacity = useProjectStore((state) => state.onionSkinOpacity)
  const updateBrush = useProjectStore((state) => state.updateBrush)
  const setCurrentFrameExposure = useProjectStore((state) => state.setCurrentFrameExposure)
  const selectLayer = useProjectStore((state) => state.selectLayer)
  const addLayer = useProjectStore((state) => state.addLayer)
  const duplicateActiveLayer = useProjectStore((state) => state.duplicateActiveLayer)
  const deleteActiveLayer = useProjectStore((state) => state.deleteActiveLayer)
  const toggleLayerVisibility = useProjectStore((state) => state.toggleLayerVisibility)
  const toggleLayerLock = useProjectStore((state) => state.toggleLayerLock)
  const setLayerOpacity = useProjectStore((state) => state.setLayerOpacity)
  const setOnionSkinEnabled = useProjectStore((state) => state.setOnionSkinEnabled)
  const setOnionSkinOpacity = useProjectStore((state) => state.setOnionSkinOpacity)
  const translateSelectedStrokes = useProjectStore((state) => state.translateSelectedStrokes)
  const rotateSelectedStrokes = useProjectStore((state) => state.rotateSelectedStrokes)
  const scaleSelectedStrokes = useProjectStore((state) => state.scaleSelectedStrokes)
  const flipSelectedStrokes = useProjectStore((state) => state.flipSelectedStrokes)
  const deleteSelectedStrokes = useProjectStore((state) => state.deleteSelectedStrokes)

  const currentFrame = frames[currentFrameIndex] ?? frames[0]
  const activeLayer =
    currentFrame.layers.find((layer) => layer.id === activeLayerId) ?? currentFrame.layers[0]
  const hasSelection = selectedStrokeIds.length > 0
  const transformDisabled = !hasSelection || activeLayer?.locked

  return (
    <aside className="inspector-panel">
      <section className="panel-section">
        <div className="panel-heading">
          <div>
            <h2>Tool & Brush</h2>
            <p>{toolLabels[activeTool]} is active. Brush settings apply to both drawing tools.</p>
          </div>
        </div>

        <div className="info-card">
          <span>Current tool</span>
          <strong>{toolLabels[activeTool]}</strong>
        </div>

        <label className="color-field">
          <span>Color</span>
          <input
            type="color"
            value={brush.color}
            onChange={(event) => updateBrush({ color: event.target.value })}
          />
        </label>

        <SliderField
          label="Size"
          min={1}
          max={64}
          value={brush.size}
          displayValue={`${brush.size}px`}
          onChange={(value) => updateBrush({ size: value })}
        />

        <SliderField
          label="Opacity"
          min={5}
          max={100}
          value={Math.round(brush.opacity * 100)}
          displayValue={`${Math.round(brush.opacity * 100)}%`}
          onChange={(value) => updateBrush({ opacity: value / 100 })}
        />

        <SliderField
          label="Taper"
          min={0}
          max={100}
          value={brush.taper}
          displayValue={`${brush.taper}%`}
          onChange={(value) => updateBrush({ taper: value })}
        />

        <SliderField
          label="Stabilization"
          min={0}
          max={100}
          value={brush.stabilization}
          displayValue={`${brush.stabilization}%`}
          onChange={(value) => updateBrush({ stabilization: value })}
        />
      </section>

      <section className="panel-section">
        <div className="panel-heading">
          <div>
            <h2>Selection & Transform</h2>
            <p>Select strokes with `V`, drag to move them, or use these buttons for transforms.</p>
          </div>
        </div>

        <div className="info-card">
          <span>Selection</span>
          <strong>{selectedStrokeIds.length} stroke(s)</strong>
        </div>

        <div className="transform-grid">
          <button onClick={() => translateSelectedStrokes(0, -8)} disabled={transformDisabled}>
            Nudge Up
          </button>
          <button onClick={() => translateSelectedStrokes(-8, 0)} disabled={transformDisabled}>
            Nudge Left
          </button>
          <button onClick={() => translateSelectedStrokes(8, 0)} disabled={transformDisabled}>
            Nudge Right
          </button>
          <button onClick={() => translateSelectedStrokes(0, 8)} disabled={transformDisabled}>
            Nudge Down
          </button>
          <button onClick={() => rotateSelectedStrokes(-15)} disabled={transformDisabled}>
            Rotate -15°
          </button>
          <button onClick={() => rotateSelectedStrokes(15)} disabled={transformDisabled}>
            Rotate +15°
          </button>
          <button onClick={() => scaleSelectedStrokes(0.92, 0.92)} disabled={transformDisabled}>
            Scale Down
          </button>
          <button onClick={() => scaleSelectedStrokes(1.08, 1.08)} disabled={transformDisabled}>
            Scale Up
          </button>
          <button onClick={() => flipSelectedStrokes('horizontal')} disabled={transformDisabled}>
            Flip Horizontal
          </button>
          <button onClick={() => flipSelectedStrokes('vertical')} disabled={transformDisabled}>
            Flip Vertical
          </button>
          <button
            className="button-danger"
            onClick={deleteSelectedStrokes}
            disabled={transformDisabled}
          >
            Delete Selection
          </button>
        </div>
      </section>

      <section className="panel-section">
        <div className="panel-heading">
          <div>
            <h2>Layers</h2>
            <p>Layers stay aligned across frames, so you can animate cleanly on separate passes.</p>
          </div>
        </div>

        <div className="layer-actions">
          <button onClick={addLayer}>Add Layer</button>
          <button onClick={duplicateActiveLayer}>Duplicate</button>
          <button className="button-danger" onClick={deleteActiveLayer}>
            Delete
          </button>
        </div>

        <div className="layer-list">
          {[...currentFrame.layers].reverse().map((layer) => (
            <div
              key={layer.id}
              className={`layer-row ${layer.id === activeLayerId ? 'layer-row-active' : ''}`}
            >
              <button className="layer-main" onClick={() => selectLayer(layer.id)}>
                <strong>{layer.name}</strong>
                <span>{layer.strokes.length} strokes</span>
              </button>
              <button
                className="mini-button"
                onClick={() => toggleLayerVisibility(layer.id)}
                title={layer.visible ? 'Hide layer' : 'Show layer'}
              >
                {layer.visible ? 'Hide' : 'Show'}
              </button>
              <button
                className="mini-button"
                onClick={() => toggleLayerLock(layer.id)}
                title={layer.locked ? 'Unlock layer' : 'Lock layer'}
              >
                {layer.locked ? 'Unlock' : 'Lock'}
              </button>
            </div>
          ))}
        </div>

        {activeLayer && (
          <SliderField
            label={`${activeLayer.name} opacity`}
            min={5}
            max={100}
            value={Math.round(activeLayer.opacity * 100)}
            displayValue={`${Math.round(activeLayer.opacity * 100)}%`}
            onChange={(value) => setLayerOpacity(activeLayer.id, value / 100)}
          />
        )}
      </section>

      <section className="panel-section">
        <div className="panel-heading">
          <div>
            <h2>Animation</h2>
            <p>Frame hold controls how long the current frame stays on screen during playback.</p>
          </div>
        </div>

        <div className="info-card">
          <span>Current frame</span>
          <strong>
            {currentFrameIndex + 1} / {frames.length}
          </strong>
        </div>

        <div className="info-card">
          <span>Frame content</span>
          <strong>{countFrameStrokes(currentFrame)} strokes</strong>
        </div>

        <SliderField
          label="Frame hold"
          min={1}
          max={12}
          value={currentFrame.exposure}
          displayValue={`x${currentFrame.exposure}`}
          onChange={setCurrentFrameExposure}
        />

        <label className="toggle-field">
          <span>Previous-frame onion skin</span>
          <input
            type="checkbox"
            checked={onionSkinEnabled}
            onChange={(event) => setOnionSkinEnabled(event.target.checked)}
          />
        </label>

        <SliderField
          label="Onion skin opacity"
          min={5}
          max={45}
          value={Math.round(onionSkinOpacity * 100)}
          displayValue={`${Math.round(onionSkinOpacity * 100)}%`}
          onChange={(value) => setOnionSkinOpacity(value / 100)}
        />
      </section>

      <section className="panel-section">
        <div className="panel-heading">
          <div>
            <h2>Shortcuts</h2>
            <p>These are wired into the editor now.</p>
          </div>
        </div>

        <div className="shortcut-list">
          <div className="shortcut-row">
            <span>Undo / Redo</span>
            <strong>Ctrl/Cmd+Z, Ctrl/Cmd+Y</strong>
          </div>
          <div className="shortcut-row">
            <span>Brush / Eraser / Select</span>
            <strong>B, E, V</strong>
          </div>
          <div className="shortcut-row">
            <span>Play / Pause</span>
            <strong>Space</strong>
          </div>
          <div className="shortcut-row">
            <span>Delete selection</span>
            <strong>Delete</strong>
          </div>
          <div className="shortcut-row">
            <span>Nudge selection</span>
            <strong>Arrow keys</strong>
          </div>
        </div>
      </section>
    </aside>
  )
}
