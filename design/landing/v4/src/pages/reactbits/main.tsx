import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles.css'
import { MotionDemo } from './MotionDemo'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionDemo />
  </StrictMode>,
)
