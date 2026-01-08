// Path: lib\utils\reportes.ts
import * as XLSX from 'xlsx'

// Rango de fechas predefinido
export type RangoFecha = 'hoy' | 'ayer' | 'ultimos-7' | 'ultimos-30' | 'este-mes' | 'mes-anterior' | 'personalizado'

export interface FiltroFecha {
  desde: string
  hasta: string
}

// Obtener fechas según rango seleccionado
export function obtenerRangoFechas(rango: RangoFecha): FiltroFecha {
  const hoy = new Date()
  const ayer = new Date(hoy)
  ayer.setDate(ayer.getDate() - 1)

  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
  const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0)

  const formatearFecha = (fecha: Date): string => {
    return fecha.toISOString().split('T')[0]
  }

  switch (rango) {
    case 'hoy':
      return {
        desde: formatearFecha(hoy),
        hasta: formatearFecha(hoy)
      }
    case 'ayer':
      return {
        desde: formatearFecha(ayer),
        hasta: formatearFecha(ayer)
      }
    case 'ultimos-7':
      const hace7Dias = new Date(hoy)
      hace7Dias.setDate(hace7Dias.getDate() - 7)
      return {
        desde: formatearFecha(hace7Dias),
        hasta: formatearFecha(hoy)
      }
    case 'ultimos-30':
      const hace30Dias = new Date(hoy)
      hace30Dias.setDate(hace30Dias.getDate() - 30)
      return {
        desde: formatearFecha(hace30Dias),
        hasta: formatearFecha(hoy)
      }
    case 'este-mes':
      return {
        desde: formatearFecha(inicioMes),
        hasta: formatearFecha(hoy)
      }
    case 'mes-anterior':
      return {
        desde: formatearFecha(inicioMesAnterior),
        hasta: formatearFecha(finMesAnterior)
      }
    default:
      return {
        desde: formatearFecha(inicioMes),
        hasta: formatearFecha(hoy)
      }
  }
}

// Exportar a Excel
export function exportarAExcel(
  datos: any[],
  nombreHoja: string,
  nombreArchivo: string
) {
  const worksheet = XLSX.utils.json_to_sheet(datos)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, nombreHoja)

  // Ajustar ancho de columnas automáticamente
  const maxWidth = datos.reduce((w, r) => Math.max(w, Object.keys(r).length), 10)
  worksheet['!cols'] = Array(maxWidth).fill({ wch: 15 })

  XLSX.writeFile(workbook, `${nombreArchivo}.xlsx`)
}

// Formatear datos para Excel (eliminar símbolos, usar números)
export function prepararDatosParaExcel(datos: any[]): any[] {
  return datos.map(item => {
    const itemLimpio: any = {}
    
    Object.keys(item).forEach(key => {
      const valor = item[key]
      
      // Si es un valor de moneda (Bs. X.XX), extraer solo el número
      if (typeof valor === 'string' && valor.startsWith('Bs. ')) {
        itemLimpio[key] = parseFloat(valor.replace('Bs. ', '').replace(',', ''))
      }
      // Si es porcentaje (X%), extraer solo el número
      else if (typeof valor === 'string' && valor.endsWith('%')) {
        itemLimpio[key] = parseFloat(valor.replace('%', ''))
      }
      // Si es número con comas (1,234), convertir a número
      else if (typeof valor === 'string' && /^[\d,]+$/.test(valor)) {
        itemLimpio[key] = parseFloat(valor.replace(/,/g, ''))
      }
      // Dejar el valor como está
      else {
        itemLimpio[key] = valor
      }
    })
    
    return itemLimpio
  })
}

// Calcular variación porcentual
export function calcularVariacion(actual: number, anterior: number): {
  porcentaje: number
  texto: string
  color: string
} {
  if (anterior === 0) {
    return {
      porcentaje: actual > 0 ? 100 : 0,
      texto: actual > 0 ? '+100%' : '0%',
      color: actual > 0 ? 'text-emerald-600' : 'text-gray-600'
    }
  }

  const porcentaje = ((actual - anterior) / anterior) * 100
  const texto = porcentaje >= 0 ? `+${porcentaje.toFixed(1)}%` : `${porcentaje.toFixed(1)}%`
  const color = porcentaje >= 0 ? 'text-emerald-600' : 'text-red-600'

  return { porcentaje, texto, color }
}

// Colores para gráficas
export const COLORES_GRAFICAS = {
  principal: '#10B981', // emerald-500
  secundario: '#3B82F6', // blue-500
  terciario: '#F59E0B', // amber-500
  peligro: '#EF4444', // red-500
  exito: '#10B981', // emerald-500
  advertencia: '#F59E0B', // amber-500
}

// Formatear número a moneda boliviana
export function formatearMoneda(valor: number): string {
  return `Bs. ${valor.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

// Formatear porcentaje
export function formatearPorcentaje(valor: number, decimales: number = 1): string {
  return `${valor.toFixed(decimales)}%`
}

// Truncar texto largo
export function truncarTexto(texto: string, maxCaracteres: number): string {
  if (texto.length <= maxCaracteres) return texto
  return texto.substring(0, maxCaracteres) + '...'
}