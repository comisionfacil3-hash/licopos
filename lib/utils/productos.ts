// Path: lib\utils\productos.ts
// lib/utils/productos.ts
// ControlaPos v2.1 - Utilidades para productos
// COMPLETO con todas las funciones requeridas

import { Producto, StockStatus } from '@/types/database'

// Obtener estado del stock - RETORNA VALORES DEL ENUM
export function getStockStatus(producto: Producto): StockStatus {
  if (producto.stock_actual === 0) {
    return StockStatus.SIN_STOCK
  } else if (producto.stock_actual <= producto.stock_minimo) {
    return StockStatus.STOCK_BAJO
  } else if (producto.stock_actual >= producto.stock_maximo) {
    return StockStatus.STOCK_ALTO
  } else {
    return StockStatus.STOCK_NORMAL
  }
}

// Obtener color segĂşn estado del stock
export function getStockColor(status: StockStatus): string {
  switch (status) {
    case StockStatus.SIN_STOCK:
      return 'text-red-600 bg-red-50'
    case StockStatus.STOCK_BAJO:
      return 'text-amber-600 bg-amber-50'
    case StockStatus.STOCK_NORMAL:
      return 'text-emerald-600 bg-emerald-50'
    case StockStatus.STOCK_ALTO:
      return 'text-blue-600 bg-blue-50'
    default:
      return 'text-gray-600 bg-gray-50'
  }
}

// Obtener texto del estado de stock
export function getStockText(status: StockStatus): string {
  switch (status) {
    case StockStatus.SIN_STOCK:
      return 'Sin stock'
    case StockStatus.STOCK_BAJO:
      return 'Stock bajo'
    case StockStatus.STOCK_NORMAL:
      return 'Normal'
    case StockStatus.STOCK_ALTO:
      return 'Stock alto'
    default:
      return 'Desconocido'
  }
}

// ALIAS: getStockStatusText (para compatibilidad)
export function getStockStatusText(status: StockStatus): string {
  return getStockText(status)
}

// Formatear unidad de producto
export function formatearUnidad(unidad: string, cantidad: number = 1): string {
  const unidades: Record<string, { singular: string; plural: string }> = {
    'unidad': { singular: 'unidad', plural: 'unidades' },
    'botella': { singular: 'botella', plural: 'botellas' },
    'caja': { singular: 'caja', plural: 'cajas' },
    'paquete': { singular: 'paquete', plural: 'paquetes' },
    'lata': { singular: 'lata', plural: 'latas' },
    'sixpack': { singular: 'sixpack', plural: 'sixpacks' },
    'litro': { singular: 'litro', plural: 'litros' },
    'kg': { singular: 'kg', plural: 'kg' },
    'gr': { singular: 'gr', plural: 'gr' },
  }

  const u = unidades[unidad.toLowerCase()]
  if (u) {
    return cantidad === 1 ? u.singular : u.plural
  }
  return unidad
}

// Calcular margen de ganancia
export function calcularMargen(precioCompra: number, precioVenta: number): number {
  if (precioCompra <= 0) return 0
  return ((precioVenta - precioCompra) / precioCompra) * 100
}

// Generar cĂłdigo de producto (formato PROD0001)
export function generarCodigoProducto(numero: number): string {
  return `PROD${numero.toString().padStart(4, '0')}`
}

// Validar cĂłdigo de barras (bĂˇsico)
export function validarCodigoBarras(codigo: string): boolean {
  if (!codigo) return true
  return /^[0-9]{8,13}$/.test(codigo)
}

// Formatear stock con indicador visual
export function formatStock(producto: Producto): {
  text: string
  color: string
  status: StockStatus
} {
  const status = getStockStatus(producto)
  return {
    text: `${producto.stock_actual} ${producto.unidad}`,
    color: getStockColor(status),
    status
  }
}

// Validar datos del producto antes de guardar
export function validarProducto(data: Partial<Producto>): string[] {
  const errores: string[] = []
  
  if (!data.nombre?.trim()) {
    errores.push('El nombre es requerido')
  }
  
  if (data.precio_venta === undefined || data.precio_venta < 0) {
    errores.push('El precio de venta debe ser mayor o igual a 0')
  }
  
  if (data.precio_compra === undefined || data.precio_compra < 0) {
    errores.push('El precio de compra debe ser mayor o igual a 0')
  }
  
  if (data.stock_actual !== undefined && data.stock_actual < 0) {
    errores.push('El stock no puede ser negativo')
  }
  
  if (data.stock_minimo !== undefined && data.stock_minimo < 0) {
    errores.push('El stock mĂ­nimo no puede ser negativo')
  }
  
  if (data.stock_maximo !== undefined && data.stock_maximo < 0) {
    errores.push('El stock mĂˇximo no puede ser negativo')
  }
  
  if (data.codigo_barras && !validarCodigoBarras(data.codigo_barras)) {
    errores.push('CĂłdigo de barras invĂˇlido (debe ser 8-13 dĂ­gitos)')
  }
  
  return errores
}

// Calcular valor del inventario
export function calcularValorInventario(productos: Producto[]): {
  costoTotal: number
  ventaTotal: number
  utilidadPotencial: number
} {
  let costoTotal = 0
  let ventaTotal = 0
  
  productos.forEach(p => {
    costoTotal += p.precio_compra * p.stock_actual
    ventaTotal += p.precio_venta * p.stock_actual
  })
  
  return {
    costoTotal,
    ventaTotal,
    utilidadPotencial: ventaTotal - costoTotal
  }
}

// Filtrar productos por estado de stock
export function filtrarPorStock(productos: Producto[], status: StockStatus): Producto[] {
  return productos.filter(p => getStockStatus(p) === status)
}

// Contar productos por estado de stock
export function contarPorStock(productos: Producto[]): {
  sinStock: number
  stockBajo: number
  normal: number
} {
  let sinStock = 0
  let stockBajo = 0
  let normal = 0
  
  productos.forEach(p => {
    const status = getStockStatus(p)
    if (status === StockStatus.SIN_STOCK) sinStock++
    else if (status === StockStatus.STOCK_BAJO) stockBajo++
    else normal++
  })
  
  return { sinStock, stockBajo, normal }
}