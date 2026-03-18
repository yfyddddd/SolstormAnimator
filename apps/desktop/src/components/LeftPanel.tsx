import { useProjectStore } from '../state/projectStore'
import type { Tool } from '../types'

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

export function LeftPanel({ open, activeTab, onToggleTab }: LeftPanelProps) {
  const activeTool = useProjectStore((state) => state.activeTool)
  const brush = useProjectStore((state) => state.brush)
  const setActiveTool = useProjectStore((state) => state.setActiveTool)
  const updateBrush = useProjectStore((state) => state.updateBrush)

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
          <span>Style</span>
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
                ? 'Switch between drawing, erasing, and selecting without covering the canvas.'
                : 'Dial in your stroke feel here while the stage stays open.'}
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
                  <span>Navigation</span>
                  <strong>Touch, pinch, rotate</strong>
                </div>
                <div className="shortcut-row">
                  <span>Brush size</span>
                  <strong>[ and ]</strong>
                </div>
                <div className="shortcut-row">
                  <span>Playback</span>
                  <strong>Space</strong>
                </div>
                <div className="shortcut-row">
                  <span>Undo / Redo</span>
                  <strong>Ctrl/Cmd+Z</strong>
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="panel-card">
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

              <section className="panel-card">
                <div className="info-card">
                  <span>Quick feel</span>
                  <strong>
                    {brush.size}px / {Math.round(brush.opacity * 100)}%
                  </strong>
                </div>
                <p className="drawer-note">
                  Taper makes the ends breathe. Stabilization smooths your line. Opacity lets you
                  build softly without losing control.
                </p>
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
