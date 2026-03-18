import { getBrushPresetsForTool } from '../lib/brushes'
import { useProjectStore } from '../state/projectStore'
import type { DrawingTool, Tool } from '../types'

export type LeftPanelTab = 'tools' | 'brush'

type LeftPanelProps = {
  open: boolean
  activeTab: LeftPanelTab
  onToggleTab: (tab: LeftPanelTab) => void
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

const tools: { id: Tool; label: string; shortcut: string }[] = [
  { id: 'brush', label: 'Brush', shortcut: 'B' },
  { id: 'eraser', label: 'Eraser', shortcut: 'E' },
  { id: 'select', label: 'Select', shortcut: 'V' }
]

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

const tipLabels = {
  round: 'Round',
  fine: 'Fine Pen',
  paint: 'Paintbrush',
  grain: 'Grain',
  'stamp-star': 'Star Stamp',
  'stamp-square': 'Square Stamp'
} as const

export function LeftPanel({ open, activeTab, onToggleTab }: LeftPanelProps) {
  const activeTool = useProjectStore((state) => state.activeTool)
  const lastDrawingTool = useProjectStore((state) => state.lastDrawingTool)
  const toolPresets = useProjectStore((state) => state.toolPresets)
  const setActiveTool = useProjectStore((state) => state.setActiveTool)
  const updateBrush = useProjectStore((state) => state.updateBrush)
  const applyBrushPreset = useProjectStore((state) => state.applyBrushPreset)

  const editableTool: DrawingTool = activeTool === 'select' ? lastDrawingTool : activeTool
  const brush = toolPresets[editableTool]
  const presets = getBrushPresetsForTool(editableTool)

  return (
    <div className="panel-anchor panel-anchor-left">
      <div className="side-dock side-dock-left">
        {tools.map((tool) => (
          <button
            key={tool.id}
            className={`dock-button ${activeTool === tool.id ? 'dock-button-active' : ''}`}
            onClick={() => {
              setActiveTool(tool.id)
              onToggleTab('tools')
            }}
          >
            <strong>{tool.label}</strong>
            <span>{tool.shortcut}</span>
          </button>
        ))}

        <button
          className={`dock-button ${open && activeTab === 'brush' ? 'dock-button-active' : ''}`}
          onClick={() => onToggleTab('brush')}
        >
          <strong>Brush</strong>
          <span>Look</span>
        </button>
      </div>

      <aside
        className={`floating-drawer floating-drawer-left ${
          open ? 'floating-drawer-open' : ''
        }`}
      >
        <div className="drawer-header">
          <div>
            <span className="drawer-eyebrow">Studio Left</span>
            <h2>{activeTab === 'tools' ? 'Tools' : 'Brush Lab'}</h2>
            <p>
              {activeTab === 'tools'
                ? 'Switch tools fast while the canvas stays front and center.'
                : 'Every drawing tool keeps its own settings now, so brush and eraser stop fighting each other.'}
            </p>
          </div>

          <button className="mini-button" onClick={() => onToggleTab(activeTab)}>
            Close
          </button>
        </div>

        <div className="drawer-tabs">
          <button
            className={`drawer-tab ${activeTab === 'tools' ? 'drawer-tab-active' : ''}`}
            onClick={() => onToggleTab('tools')}
          >
            Tools
          </button>
          <button
            className={`drawer-tab ${activeTab === 'brush' ? 'drawer-tab-active' : ''}`}
            onClick={() => onToggleTab('brush')}
          >
            Brush
          </button>
        </div>

        <div className="drawer-body">
          {activeTab === 'tools' ? (
            <>
              <section className="panel-card">
                <div className="info-card">
                  <span>Current tool</span>
                  <strong>{tools.find((tool) => tool.id === activeTool)?.label ?? 'Brush'}</strong>
                </div>

                <div className="tool-stack">
                  {tools.map((tool) => (
                    <button
                      key={tool.id}
                      className={`tool-button ${
                        activeTool === tool.id ? 'tool-button-active' : ''
                      }`}
                      onClick={() => setActiveTool(tool.id)}
                    >
                      <span>{tool.label}</span>
                      <strong>{tool.shortcut}</strong>
                    </button>
                  ))}
                </div>
              </section>

              <section className="panel-card">
                <div className="shortcut-row">
                  <span>Brush / Eraser / Select</span>
                  <strong>B, E, V</strong>
                </div>
                <div className="shortcut-row">
                  <span>Resize active drawing tool</span>
                  <strong>[ and ]</strong>
                </div>
                <div className="shortcut-row">
                  <span>Touch navigation</span>
                  <strong>Pan, pinch, rotate</strong>
                </div>
                <div className="shortcut-row">
                  <span>Reset view</span>
                  <strong>0</strong>
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="panel-card">
                <div className="tool-profile-switcher">
                  <button
                    className={editableTool === 'brush' ? 'tool-button-active' : ''}
                    onClick={() => setActiveTool('brush')}
                  >
                    Brush Profile
                  </button>
                  <button
                    className={editableTool === 'eraser' ? 'tool-button-active' : ''}
                    onClick={() => setActiveTool('eraser')}
                  >
                    Eraser Profile
                  </button>
                </div>

                <div className="info-card">
                  <span>Editing</span>
                  <strong>
                    {editableTool === 'brush' ? 'Brush' : 'Eraser'} / {tipLabels[brush.tip]}
                  </strong>
                </div>

                <div className="preset-grid">
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      className={`preset-card ${
                        brush.presetId === preset.id ? 'preset-card-active' : ''
                      }`}
                      onClick={() => applyBrushPreset(preset.id)}
                    >
                      <strong>{preset.label}</strong>
                      <span>{preset.description}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="panel-card">
                {editableTool === 'brush' ? (
                  <label className="color-field">
                    <span>Color</span>
                    <input
                      type="color"
                      value={brush.color}
                      onChange={(event) => updateBrush({ color: event.target.value })}
                    />
                  </label>
                ) : null}

                <SliderField
                  label="Size"
                  min={1}
                  max={96}
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

                <SliderField
                  label="Grain"
                  min={0}
                  max={100}
                  value={brush.grain}
                  displayValue={`${brush.grain}%`}
                  onChange={(value) => updateBrush({ grain: value })}
                />

                <SliderField
                  label="Stamp spacing"
                  min={0}
                  max={100}
                  value={brush.spacing}
                  displayValue={`${brush.spacing}%`}
                  onChange={(value) => updateBrush({ spacing: value })}
                />

                <SliderField
                  label="Pressure size"
                  min={0}
                  max={100}
                  value={brush.pressureSize}
                  displayValue={`${brush.pressureSize}%`}
                  onChange={(value) => updateBrush({ pressureSize: value })}
                />

                <SliderField
                  label="Pressure opacity"
                  min={0}
                  max={100}
                  value={brush.pressureOpacity}
                  displayValue={`${brush.pressureOpacity}%`}
                  onChange={(value) => updateBrush({ pressureOpacity: value })}
                />
              </section>

              <section className="panel-card">
                <div className="info-card">
                  <span>Quick feel</span>
                  <strong>
                    {brush.size}px / {Math.round(brush.opacity * 100)}%
                  </strong>
                </div>
                <p className="drawer-note">
                  Fine Pen stays clean, Paintbrush reacts more to pressure, Grain Shader gives
                  texture, and the stamp brushes repeat shapes along the stroke path.
                </p>
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
