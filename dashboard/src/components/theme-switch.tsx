'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { setTheme, useTheme, type Theme } from '../lib/theme'

const themeOptions = [
  { label: 'System', Icon: Monitor },
  { label: 'Light', Icon: Sun },
  { label: 'Dark', Icon: Moon },
]

export default function ThemeSwitch() {
  const theme = useTheme()
  return (
    <div className="theme-switch" role="group" aria-label="Theme" data-theme={theme}>
      <span className="theme-thumb" aria-hidden="true" />
      {themeOptions.map(({ label, Icon }) => (
        <button key={label} type="button" aria-label={label} aria-pressed={theme === label.toLowerCase()} onClick={() => setTheme(label.toLowerCase() as Theme)}>
          <Icon size={14} strokeWidth={2} absoluteStrokeWidth aria-hidden />
        </button>
      ))}
    </div>
  )
}
