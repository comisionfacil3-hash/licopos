// Path: components\ui\spinner.tsx
import { cn } from '@/lib/utils/cn'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border',
    md: 'w-5 h-5 border-2',
    lg: 'w-8 h-8 border-2'
  }

  return (
    <div className={cn(
      'border-gray-200 border-t-primary-500 rounded-full animate-spin',
      sizeClasses[size],
      className
    )} />
  )
}