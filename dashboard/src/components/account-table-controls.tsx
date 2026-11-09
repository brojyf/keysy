'use client'

import { Search, X } from 'lucide-react'
import { useRef, type ToggleEvent } from 'react'

export function TableSearch({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="account-search">
      <Search size={14} strokeWidth={1.17} absoluteStrokeWidth aria-hidden />
      <input ref={input} value={value} placeholder={label} aria-label={label} onInput={(event) => onChange(event.currentTarget.value)} />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => { onChange(''); input.current?.focus() }}>
          <X size={14} strokeWidth={2} absoluteStrokeWidth aria-hidden />
        </button>
      )}
    </div>
  )
}

export function SortableHeader({ label, direction, onToggle }: { label: string; direction: 'ascending' | 'descending'; onToggle: () => void }) {
  return (
    <th aria-sort={direction}>
      <button className="account-sort" type="button" onClick={onToggle}>
        {label}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M17 10L12 5L7 10M12 5V19" />
        </svg>
      </button>
    </th>
  )
}

// Figma Icon/ellipsis: solid dots, unlike the stroked lucide icon.
export function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="3.33" cy="8" r="1.67" />
      <circle cx="8" cy="8" r="1.67" />
      <circle cx="12.67" cy="8" r="1.67" />
    </svg>
  )
}

// Opens a row menu below its trigger, right aligned to it.
export function placeRowMenu(event: ToggleEvent<HTMLDivElement>) {
  if (event.newState !== 'open') return
  const menu = event.currentTarget
  const trigger = menu.previousElementSibling!.getBoundingClientRect()
  menu.style.top = `${trigger.bottom + 4}px`
  menu.style.right = `${document.documentElement.clientWidth - trigger.right}px`
}
