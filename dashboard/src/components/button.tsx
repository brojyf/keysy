import type { ComponentProps } from 'react'

// Mirrors the Figma Button component set: Variant = Secondary | Primary | Danger.
const variantClasses = {
  secondary: 'button',
  primary: 'button button-primary',
  danger: 'button button-danger',
}

type ButtonProps = Omit<ComponentProps<'button'>, 'className'> & {
  variant?: keyof typeof variantClasses
}

export default function Button({ variant = 'secondary', type = 'button', ...props }: ButtonProps) {
  return <button className={variantClasses[variant]} type={type} {...props} />
}
