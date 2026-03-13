import { useEffect, useRef } from 'react'
import { countFrameStrokes, drawFrameThumbnail } from '../lib/drawing'
import { useProjectStore } from '../state/projectStore'
import type { Frame } from '../types'

const THUMBNAIL_WIDTH = 144
const THUMBNAIL_HEIGHT = 81

type FrameTileProps = {
  frame: Frame
  index: number
  isActive: boolean
  onSelect: () => void
}

function FrameTile({ frame, index, isActive, onSelect }: FrameTileProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d')

    if (!context) {
      return
    }

    drawFrameThumbnail(context, frame, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT)
  }, [frame])

  return (
    <button
      className={`timeline-frame ${isActive ? 'timeline-frame-active' : ''}`}
      onClick={onSelect}
    >
      <div className="timeline-frame-header">
        <span>Frame {index + 1}</span>
        <span>Hold x{frame.exposure}</span>
      </div>
      <canvas ref={canvasRef} width={THUMBNAIL_WIDTH} height={THUMBNAIL_HEIGHT} />
      <div className="timeline-frame-meta">
        <span>{frame.layers.length} layers</span>
        <span>{countFrameStrokes(frame)} strokes</span>
      </div>
    </button>
  )
}

export function Timeline() {
  const frames = useProjectStore((state) => state.frames)
  const currentFrameIndex = useProjectStore((state) => state.currentFrameIndex)
  const selectFrame = useProjectStore((state) => state.selectFrame)
  const addFrame = useProjectStore((state) => state.addFrame)

  return (
    <section className="timeline-panel">
      <div className="panel-heading">
        <div>
          <h2>Timeline</h2>
          <p>Frame holds live directly on each thumbnail so you can feel the rhythm faster.</p>
        </div>

        <button onClick={addFrame}>Add Frame</button>
      </div>

      <div className="timeline-strip">
        {frames.map((frame, index) => (
          <FrameTile
            key={frame.id}
            frame={frame}
            index={index}
            isActive={index === currentFrameIndex}
            onSelect={() => selectFrame(index)}
          />
        ))}
      </div>
    </section>
  )
}
