// Path: lib\utils\format.ts
/**
 * Formatear cantidad de dinero en bolivianos
 * Ejemplo: formatCurrency(1234.56) → "Bs. 1,234.56"
 */
export function formatCurrency(amount: number): string {
  if (isNaN(amount)) return 'Bs. 0.00'
  
  return `Bs. ${amount.toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

/**
 * Formatear número sin símbolo de moneda
 * Ejemplo: formatNumber(1234) → "1,234"
 */
export function formatNumber(num: number): string {
  if (isNaN(num)) return '0'
  return num.toLocaleString('es-BO')
}

/**
 * Convertir texto a número (quita símbolos de moneda)
 * Ejemplo: parseCurrency("Bs. 1,234.56") → 1234.56
 */
export function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^\d.-]/g, '')
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}

/**
 * Formatear porcentaje
 * Ejemplo: formatPercent(0.25) → "25%"
 */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

/**
 * Calcular margen de ganancia
 * Ejemplo: calculateMargin(100, 80) → 0.20 (20%)
 */
export function calculateMargin(precioVenta: number, precioCosto: number): number {
  if (precioCosto === 0 || precioVenta === 0) return 0
  return (precioVenta - precioCosto) / precioVenta
}

/**
 * Formatear margen con símbolo
 * Ejemplo: formatMargin(100, 80) → "20.0%"
 */
export function formatMargin(precioVenta: number, precioCosto: number): string {
  const margin = calculateMargin(precioVenta, precioCosto)
  return formatPercent(margin)
}

/**
 * Truncar texto si es muy largo
 * Ejemplo: truncateText("Texto muy largo", 10) → "Texto muy..."
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

/**
 * Capitalizar primera letra
 * Ejemplo: capitalize("hola mundo") → "Hola mundo"
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

/**
 * Generar código automático para productos
 * Ejemplo: generateProductCode("Cerveza Paceña") → "CERV-PAC"
 */
export function generateProductCode(productName: string): string {
  const words = productName
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 0)
  
  if (words.length === 0) return 'PROD'
  if (words.length === 1) return words[0].substring(0, 8)
  
  const firstWord = words[0].substring(0, 4)
  const secondWord = words[1].substring(0, 3)
  return `${firstWord}-${secondWord}`
}