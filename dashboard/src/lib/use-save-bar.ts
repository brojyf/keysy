import { useEffect, useRef, useState } from 'react'
import { exitAnimationFinished } from './exit-animation'

type SaveState = 'idle' | 'saving' | 'saved' | 'leaving'

/** Mount, success, and exit lifecycle for a one-field floating save bar. */
export function useSaveBar(changed: boolean) {
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const saving = saveState === 'saving'
  const saved = saveState === 'saved' || saveState === 'leaving'
  const ref = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  if (changed && !mounted) setMounted(true)

  useEffect(() => {
    if (saveState !== 'saved') return
    const timer = setTimeout(() => setSaveState('leaving'), 800)
    return () => clearTimeout(timer)
  }, [saveState])

  useEffect(() => {
    if (changed || saving || saveState === 'saved' || !ref.current) return
    let interrupted = false
    void exitAnimationFinished(ref.current).then(() => {
      if (!interrupted) {
        setMounted(false)
        setSaveState('idle')
      }
    })
    return () => { interrupted = true }
  }, [changed, saving, saveState])

  const visible = changed || saving || saveState === 'saved'
  return { saveState, setSaveState, saving, saved, mounted, visible, ref }
}
