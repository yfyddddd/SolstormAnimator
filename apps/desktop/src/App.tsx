import { useEffect, useRef, useState } from 'react'
import { FrameCanvas } from './components/FrameCanvas'
import { RightPanel } from './components/RightPanel'
import { Timeline } from './components/Timeline'
import { Toolbar } from './components/Toolbar'
import { useProjectStore } from './state/projectStore'

export default function App() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const canvasContainerRef = useRef<HTMLDivElement>(null)

  const isPlaying = useProjectStore((state) => state.isPlaying)
  const fps = useProjectStore((state) => state.fps)
  const advancePlayback = useProjectStore((state) => state.advancePlayback)

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }

    document.addEventListener('fullscreenchange', onFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [])

  useEffect(() => {
    if (!isPlaying) {
      return
    }

    const frameDuration = 1000 / fps
    let animationFrameId = 0
    let lastTime = performance.now()
    let accumulatedTime = 0

    const step = (time: number) => {
      accumulatedTime += time - lastTime
      lastTime = time

      while (accumulatedTime >= frameDuration) {
        advancePlayback()
        accumulatedTime -= frameDuration
      }

      animationFrameId = requestAnimationFrame(step)
    }

    animationFrameId = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [advancePlayback, fps, isPlaying])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isFormField =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)

      if (isFormField) {
        return
      }

      const state = useProjectStore.getState()
      const modifierPressed = event.ctrlKey || event.metaKey
      const lowercaseKey = event.key.toLowerCase()

      if (modifierPressed && lowercaseKey === 'z') {
        event.preventDefault()

        if (event.shiftKey) {
          state.redo()
        } else {
          state.undo()
        }

        return
      }

      if (modifierPressed && lowercaseKey === 'y') {
        event.preventDefault()
        state.redo()
        return
      }

      if (event.code === 'Space') {
        event.preventDefault()
        state.togglePlayback()
        return
      }

      if (lowercaseKey === 'b') {
        state.setActiveTool('brush')
        return
      }

      if (lowercaseKey === 'e') {
        state.setActiveTool('eraser')
        return
      }

      if (lowercaseKey === 'v') {
        state.setActiveTool('select')
        return
      }

      if (lowercaseKey === '[') {
        event.preventDefault()
        state.updateBrush({ size: Math.max(1, state.brush.size - 1) })
        return
      }

      if (lowercaseKey === ']') {
        event.preventDefault()
        state.updateBrush({ size: Math.min(64, state.brush.size + 1) })
        return
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && state.selectedStrokeIds.length) {
        event.preventDefault()
        state.deleteSelectedStrokes()
        return
      }

      if (event.key === 'Escape') {
        state.clearSelection()
        return
      }

      if (state.activeTool === 'select' && state.selectedStrokeIds.length > 0) {
        const nudgeAmount = event.shiftKey ? 8 : 2

        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          state.translateSelectedStrokes(-nudgeAmount, 0)
          return
        }

        if (event.key === 'ArrowRight') {
          event.preventDefault()
          state.translateSelectedStrokes(nudgeAmount, 0)
          return
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault()
          state.translateSelectedStrokes(0, -nudgeAmount)
          return
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault()
          state.translateSelectedStrokes(0, nudgeAmount)
        }

        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        state.stepFrame(-1)
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        state.stepFrame(1)
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await canvasContainerRef.current?.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch (error) {
      console.error('Fullscreen error:', error)
    }
  }

  return (
    <div className="app-root">
      <header className="app-header">
        <div>
          <h1>Solstorm Animator</h1>
          <p>
            Human-made animation, with the repetitive labor steadily getting lighter and the
            hands-on control staying yours.
          </p>
        </div>
      </header>

      <Toolbar isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} />

      <main className="workspace-grid">
        <FrameCanvas containerRef={canvasContainerRef} isFullscreen={isFullscreen} />
        <RightPanel />
      </main>

      <Timeline />
    </div>
  )
}
