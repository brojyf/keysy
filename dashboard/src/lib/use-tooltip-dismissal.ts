'use client'

import { useEffect, useRef } from 'react'

export function useTooltipDismissal() {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return

    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      root.querySelectorAll<HTMLElement>('[data-tooltip]').forEach((trigger) => {
        trigger.dataset.tooltipDismissed = ''
      })
    }

    function reset(event: PointerEvent | FocusEvent) {
      const trigger = (event.target as Element).closest<HTMLElement>('[data-tooltip]')
      if (trigger && !trigger.contains(event.relatedTarget as Node | null)) delete trigger.dataset.tooltipDismissed
    }

    document.addEventListener('keydown', dismiss)
    root.addEventListener('pointerover', reset)
    root.addEventListener('focusin', reset)
    return () => {
      document.removeEventListener('keydown', dismiss)
      root.removeEventListener('pointerover', reset)
      root.removeEventListener('focusin', reset)
    }
  }, [])
  return ref
}
