import type { ToggleEvent } from 'react'

// Opens a row menu below its trigger, right aligned to it.
export function placeRowMenu(event: ToggleEvent<HTMLDivElement>) {
  if (event.newState !== 'open') return
  const menu = event.currentTarget
  const trigger = menu.previousElementSibling!.getBoundingClientRect()
  menu.style.top = `${trigger.bottom + 4}px`
  menu.style.right = `${document.documentElement.clientWidth - trigger.right}px`
}
