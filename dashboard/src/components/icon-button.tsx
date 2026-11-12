import type { ComponentProps } from 'react'

// Mirrors the Figma Icon button component set: Shape = Round | Square.
const shapeClasses = {
  round: 'icon-button icon-button-round',
  square: 'icon-button icon-button-square',
}

type IconButtonProps = Omit<ComponentProps<'button'>, 'className' | 'aria-label'> & {
  'aria-label': string
  shape?: 'round' | 'square'
}

export default function IconButton({ shape = 'round', type = 'button', ...props }: IconButtonProps) {
  return <button className={shapeClasses[shape]} type={type} {...props} />
}
