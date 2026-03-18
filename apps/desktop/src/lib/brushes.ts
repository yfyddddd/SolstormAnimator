import type { BrushPresetId, BrushSettings, DrawingTool } from '../types'

export type BrushPreset = {
  id: BrushPresetId
  label: string
  description: string
  tool: DrawingTool
  settings: BrushSettings
}

const createBrush = (settings: BrushSettings) => settings

export const brushPresets: BrushPreset[] = [
  {
    id: 'round-brush',
    label: 'Round Brush',
    description: 'The all-purpose drawing brush with steady taper.',
    tool: 'brush',
    settings: createBrush({
      presetId: 'round-brush',
      color: '#ffffff',
      size: 8,
      opacity: 1,
      taper: 22,
      stabilization: 34,
      tip: 'round',
      grain: 0,
      spacing: 18,
      pressureSize: 42,
      pressureOpacity: 16
    })
  },
  {
    id: 'fine-liner',
    label: 'Fine Pen',
    description: 'Tight, clean ink lines with low spacing and a crisp edge.',
    tool: 'brush',
    settings: createBrush({
      presetId: 'fine-liner',
      color: '#ffffff',
      size: 4,
      opacity: 1,
      taper: 10,
      stabilization: 50,
      tip: 'fine',
      grain: 0,
      spacing: 8,
      pressureSize: 16,
      pressureOpacity: 6
    })
  },
  {
    id: 'paintbrush',
    label: 'Paintbrush',
    description: 'A softer textured brush that reacts more to pressure.',
    tool: 'brush',
    settings: createBrush({
      presetId: 'paintbrush',
      color: '#ffffff',
      size: 18,
      opacity: 0.82,
      taper: 36,
      stabilization: 22,
      tip: 'paint',
      grain: 18,
      spacing: 24,
      pressureSize: 78,
      pressureOpacity: 44
    })
  },
  {
    id: 'grain-shader',
    label: 'Grain Shader',
    description: 'A chalky textured brush for rough shading and fills.',
    tool: 'brush',
    settings: createBrush({
      presetId: 'grain-shader',
      color: '#ffffff',
      size: 16,
      opacity: 0.44,
      taper: 18,
      stabilization: 18,
      tip: 'grain',
      grain: 76,
      spacing: 36,
      pressureSize: 56,
      pressureOpacity: 40
    })
  },
  {
    id: 'star-stamp',
    label: 'Star Stamp',
    description: 'Repeating star shapes that follow the path like a stamp ribbon.',
    tool: 'brush',
    settings: createBrush({
      presetId: 'star-stamp',
      color: '#ffffff',
      size: 24,
      opacity: 0.92,
      taper: 0,
      stabilization: 60,
      tip: 'stamp-star',
      grain: 0,
      spacing: 78,
      pressureSize: 10,
      pressureOpacity: 6
    })
  },
  {
    id: 'square-stamp',
    label: 'Square Stamp',
    description: 'Graphic square stamps for pattern work and blocky effects.',
    tool: 'brush',
    settings: createBrush({
      presetId: 'square-stamp',
      color: '#ffffff',
      size: 22,
      opacity: 0.92,
      taper: 0,
      stabilization: 60,
      tip: 'stamp-square',
      grain: 0,
      spacing: 72,
      pressureSize: 10,
      pressureOpacity: 6
    })
  },
  {
    id: 'soft-eraser',
    label: 'Soft Eraser',
    description: 'A forgiving eraser for lifting strokes without hard edges.',
    tool: 'eraser',
    settings: createBrush({
      presetId: 'soft-eraser',
      color: '#ffffff',
      size: 18,
      opacity: 0.82,
      taper: 22,
      stabilization: 28,
      tip: 'round',
      grain: 8,
      spacing: 18,
      pressureSize: 28,
      pressureOpacity: 22
    })
  },
  {
    id: 'block-eraser',
    label: 'Block Eraser',
    description: 'A firmer eraser for cutting back shapes quickly.',
    tool: 'eraser',
    settings: createBrush({
      presetId: 'block-eraser',
      color: '#ffffff',
      size: 28,
      opacity: 1,
      taper: 0,
      stabilization: 34,
      tip: 'round',
      grain: 0,
      spacing: 14,
      pressureSize: 0,
      pressureOpacity: 0
    })
  }
]

export const getBrushPresetsForTool = (tool: DrawingTool) =>
  brushPresets.filter((preset) => preset.tool === tool)

export const getBrushPresetById = (presetId: BrushPresetId) =>
  brushPresets.find((preset) => preset.id === presetId) ?? brushPresets[0]

export const createInitialToolPresets = (): Record<DrawingTool, BrushSettings> => ({
  brush: {
    ...getBrushPresetById('round-brush').settings
  },
  eraser: {
    ...getBrushPresetById('soft-eraser').settings
  }
})

export const applyPresetToSettings = (
  currentSettings: BrushSettings,
  presetId: BrushPresetId
) => {
  const preset = getBrushPresetById(presetId)

  return {
    ...preset.settings,
    color: currentSettings.color
  }
}
