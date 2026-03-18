import { countFrameStrokes } from '../lib/drawing'
import { useProjectStore } from '../state/projectStore'

export type RightPanelTab = 'layers' | 'transform' | 'animation'

type RightPanelProps = {
  open: boolean
  activeTab: RightPanelTab
  onToggleTab: (tab: RightPanelTab) => void
}

type SliderFieldProps = {
  label: string
  min: number
  max: number
  value: number
  displayValue: string
  onChange: (value: number) => void
  step?: number
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

export function RightPanel({ open, activeTab, onToggleTab }: RightPanelProps) {
  const frames = useProjectStore((state) => state.frames)
  const currentFrameIndex = useProjectStore((state) => state.currentFrameIndex)
  const activeLayerId = useProjectStore((state) => state.activeLayerId)
  const selectedStrokeIds = useProjectStore((state) => state.selectedStrokeIds)
  const onionSkinEnabled = useProjectStore((state) => state.onionSkinEnabled)
  const onionSkinOpacity = useProjectStore((state) => state.onionSkinOpacity)
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
    <div className="panel-anchor panel-anchor-right">
      <div className="side-dock side-dock-right">
        <button
          className={`dock-button ${open && activeTab === 'layers' ? 'dock-button-active' : ''}`}
          onClick={() => onToggleTab('layers')}
        >
          <strong>Layers</strong>
          <span>{currentFrame.layers.length}</span>
        </button>
        <button
          className={`dock-button ${
            open && activeTab === 'transform' ? 'dock-button-active' : ''
          }`}
          onClick={() => onToggleTab('transform')}
        >
          <strong>Transform</strong>
          <span>{selectedStrokeIds.length}</span>
        </button>
        <button
          className={`dock-button ${
            open && activeTab === 'animation' ? 'dock-button-active' : ''
          }`}
          onClick={() => onToggleTab('animation')}
        >
          <strong>Motion</strong>
          <span>FPS</span>
        </button>
      </div>

      <aside
        className={`floating-drawer floating-drawer-right ${
          open ? 'floating-drawer-open' : ''
        }`}
      >
        <div className="drawer-header">
          <div>
            <span className="drawer-eyebrow">Studio Right</span>
            <h2>
              {activeTab === 'layers'
                ? 'Layers'
                : activeTab === 'transform'
                  ? 'Selection'
                  : 'Animation'}
            </h2>
            <p>
              {activeTab === 'layers'
                ? 'Keep passes separate and ready for cleanup or color.'
                : activeTab === 'transform'
                  ? 'Nudge, rotate, scale, and flip without losing your stroke feel.'
                  : 'Control timing, holds, and onion skin while the stage stays centered.'}
            </p>
          </div>

          <button className="mini-button" onClick={() => onToggleTab(activeTab)}>
            Close
          </button>
        </div>

        <div className="drawer-tabs">
          <button
            className={`drawer-tab ${activeTab === 'layers' ? 'drawer-tab-active' : ''}`}
            onClick={() => onToggleTab('layers')}
          >
            Layers
          </button>
          <button
            className={`drawer-tab ${activeTab === 'transform' ? 'drawer-tab-active' : ''}`}
            onClick={() => onToggleTab('transform')}
          >
            Transform
          </button>
          <button
            className={`drawer-tab ${activeTab === 'animation' ? 'drawer-tab-active' : ''}`}
            onClick={() => onToggleTab('animation')}
          >
            Animation
          </button>
        </div>

        <div className="drawer-body">
          {activeTab === 'layers' ? (
            <>
              <section className="panel-card">
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
                      className={`layer-row ${
                        layer.id === activeLayerId ? 'layer-row-active' : ''
                      }`}
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
              </section>

              {activeLayer && (
                <section className="panel-card">
                  <div className="info-card">
                    <span>Active layer</span>
                    <strong>{activeLayer.name}</strong>
                  </div>

                  <SliderField
                    label="Layer opacity"
                    min={5}
                    max={100}
                    value={Math.round(activeLayer.opacity * 100)}
                    displayValue={`${Math.round(activeLayer.opacity * 100)}%`}
                    onChange={(value) => setLayerOpacity(activeLayer.id, value / 100)}
                  />
                </section>
              )}
            </>
          ) : null}

          {activeTab === 'transform' ? (
            <>
              <section className="panel-card">
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
                    Rotate -15 deg
                  </button>
                  <button onClick={() => rotateSelectedStrokes(15)} disabled={transformDisabled}>
                    Rotate +15 deg
                  </button>
                  <button
                    onClick={() => scaleSelectedStrokes(0.92, 0.92)}
                    disabled={transformDisabled}
                  >
                    Scale Down
                  </button>
                  <button
                    onClick={() => scaleSelectedStrokes(1.08, 1.08)}
                    disabled={transformDisabled}
                  >
                    Scale Up
                  </button>
                  <button
                    onClick={() => flipSelectedStrokes('horizontal')}
                    disabled={transformDisabled}
                  >
                    Flip Horizontal
                  </button>
                  <button
                    onClick={() => flipSelectedStrokes('vertical')}
                    disabled={transformDisabled}
                  >
                    Flip Vertical
                  </button>
                  <button
                    className="button-danger transform-delete"
                    onClick={deleteSelectedStrokes}
                    disabled={transformDisabled}
                  >
                    Delete Selection
                  </button>
                </div>
              </section>

              <section className="panel-card">
                <p className="drawer-note">
                  Drag inside the blue selection box to move strokes on-canvas, then use these
                  buttons for clean nudges and fast flips.
                </p>
              </section>
            </>
          ) : null}

          {activeTab === 'animation' ? (
            <>
              <section className="panel-card">
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

              <section className="panel-card">
                <div className="shortcut-row">
                  <span>Frame hold</span>
                  <strong>x{currentFrame.exposure}</strong>
                </div>
                <div className="shortcut-row">
                  <span>Onion skin</span>
                  <strong>{onionSkinEnabled ? 'On' : 'Off'}</strong>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  )
}
