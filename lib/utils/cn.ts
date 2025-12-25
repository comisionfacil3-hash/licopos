// Path: lib\utils\cn.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utilidad para combinar clases de Tailwind CSS de forma inteligente
 * Evita conflictos entre clases similares
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}