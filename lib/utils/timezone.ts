import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// Zona horaria de Bolivia (UTC-4)
export const TIMEZONE = 'America/La_Paz'

/**
 * Formatear fecha en zona horaria de Bolivia
 * Ejemplo: "09/12/2024"
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return formatInTimeZone(dateObj, TIMEZONE, 'dd/MM/yyyy', { locale: es })
}

/**
 * Formatear fecha y hora en zona horaria de Bolivia
 * Ejemplo: "09/12/2024 14:30"
 */
export function formatDateTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return formatInTimeZone(dateObj, TIMEZONE, 'dd/MM/yyyy HH:mm', { locale: es })
}

/**
 * Formatear solo hora en zona horaria de Bolivia
 * Ejemplo: "14:30"
 */
export function formatTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return formatInTimeZone(dateObj, TIMEZONE, 'HH:mm', { locale: es })
}

/**
 * Obtener fecha y hora actual en zona horaria de Bolivia
 */
export function getNow(): Date {
  return toZonedTime(new Date(), TIMEZONE)
}

/**
 * Obtener fecha actual en formato ISO (para inputs de fecha)
 * Ejemplo: "2024-12-09"
 */
export function getToday(): string {
  return formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd')
}

/**
 * Obtener inicio del día en Bolivia
 */
export function getStartOfDay(date?: Date): Date {
  const dateToUse = date || new Date()
  const zonedDate = toZonedTime(dateToUse, TIMEZONE)
  zonedDate.setHours(0, 0, 0, 0)
  return zonedDate
}

/**
 * Obtener fin del día en Bolivia
 */
export function getEndOfDay(date?: Date): Date {
  const dateToUse = date || new Date()
  const zonedDate = toZonedTime(dateToUse, TIMEZONE)
  zonedDate.setHours(23, 59, 59, 999)
  return zonedDate
}

/**
 * Formatear fecha para mostrar (más legible)
 * Ejemplo: "Hoy", "Ayer", "09 de diciembre"
 */
export function formatDateReadable(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const today = getStartOfDay()
  const yesterday = getStartOfDay(new Date(Date.now() - 24 * 60 * 60 * 1000))
  const inputDate = getStartOfDay(dateObj)

  if (inputDate.getTime() === today.getTime()) {
    return 'Hoy'
  } else if (inputDate.getTime() === yesterday.getTime()) {
    return 'Ayer'
  } else {
    return formatInTimeZone(dateObj, TIMEZONE, 'dd \'de\' MMMM', { locale: es })
  }
}