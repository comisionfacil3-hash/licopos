// Path: lib\utils\excel-productos.ts
import * as XLSX from 'xlsx'
import { Producto, ProductoWithCategoria, Categoria } from '@/types/database'
import { formatCurrency } from '@/lib/utils/format'

// Estructura de la plantilla Excel
export interface ProductoExcelRow {
  categoria?: string
  codigo?: string
  codigo_barras?: string
  nombre: string
  descripcion?: string
  marca?: string
  unidad: string
  precio_compra: number
  precio_venta: number
  stock_actual: number
  stock_minimo: number
  stock_maximo: number
  activo: 'SI' | 'NO'
}

// Validar fila de Excel
export function validateExcelRow(row: any, index: number): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Campos obligatorios
  if (!row.nombre || !row.nombre.toString().trim()) {
    errors.push(`Fila ${index + 2}: El nombre es obligatorio`)
  }

  if (!row.precio_compra || isNaN(parseFloat(row.precio_compra))) {
    errors.push(`Fila ${index + 2}: Precio de compra debe ser un número válido`)
  }

  if (!row.precio_venta || isNaN(parseFloat(row.precio_venta))) {
    errors.push(`Fila ${index + 2}: Precio de venta debe ser un número válido`)
  }

  if (parseFloat(row.precio_venta) <= parseFloat(row.precio_compra)) {
    errors.push(`Fila ${index + 2}: Precio de venta debe ser mayor al precio de compra`)
  }

  // Validar unidad
  const unidadesValidas = ['unidad', 'caja', 'botella', 'lata', 'paquete', 'kg', 'gramos', 'litros', 'ml']
  if (row.unidad && !unidadesValidas.includes(row.unidad.toString().toLowerCase())) {
    errors.push(`Fila ${index + 2}: Unidad inválida. Use: ${unidadesValidas.join(', ')}`)
  }

  // Validar estado activo
  if (row.activo && !['SI', 'NO', 'S', 'N'].includes(row.activo.toString().toUpperCase())) {
    errors.push(`Fila ${index + 2}: Estado debe ser SI o NO`)
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

// Convertir fila Excel a objeto Producto
export function excelRowToProducto(
  row: any, 
  sucursalId: string, 
  categorias: Categoria[]
): Partial<Producto> {
  // Buscar categoría por nombre
  let categoriaId: string | undefined = undefined
  if (row.categoria) {
    const categoria = categorias.find(c => 
      c.nombre.toLowerCase() === row.categoria.toString().toLowerCase()
    )
    categoriaId = categoria?.id
  }

  return {
    sucursal_id: sucursalId,
    categoria_id: categoriaId,
    codigo: row.codigo?.toString().trim() || undefined,
    codigo_barras: row.codigo_barras?.toString().trim() || undefined,
    nombre: row.nombre.toString().trim(),
    descripcion: row.descripcion?.toString().trim() || undefined,
    marca: row.marca?.toString().trim() || undefined,
    unidad: row.unidad?.toString().toLowerCase() || 'unidad',
    precio_compra: parseFloat(row.precio_compra) || 0,
    precio_venta: parseFloat(row.precio_venta) || 0,
    stock_actual: parseInt(row.stock_actual) || 0,
    stock_minimo: parseInt(row.stock_minimo) || 5,
    stock_maximo: parseInt(row.stock_maximo) || 100,
    activo: !row.activo || ['SI', 'S'].includes(row.activo.toString().toUpperCase())
  }
}

// Generar plantilla Excel
export function generarPlantillaExcel(categorias: Categoria[]): void {
  const ejemplos: ProductoExcelRow[] = [
    {
      categoria: 'Cervezas',
      codigo: 'PROD0001',
      codigo_barras: '7804123456789',
      nombre: 'Cerveza Paceña 620ml',
      descripcion: 'Cerveza rubia nacional',
      marca: 'Paceña',
      unidad: 'botella',
      precio_compra: 8.50,
      precio_venta: 12.00,
      stock_actual: 50,
      stock_minimo: 10,
      stock_maximo: 200,
      activo: 'SI'
    },
    {
      categoria: 'Vinos',
      codigo: 'PROD0002',
      codigo_barras: '7804987654321',
      nombre: 'Vino Kohlberg Tinto 750ml',
      descripcion: 'Vino tinto boliviano',
      marca: 'Kohlberg',
      unidad: 'botella',
      precio_compra: 35.00,
      precio_venta: 50.00,
      stock_actual: 25,
      stock_minimo: 5,
      stock_maximo: 100,
      activo: 'SI'
    }
  ]

  // Crear worksheet
  const ws = XLSX.utils.json_to_sheet(ejemplos)

  // Configurar anchos de columna
  const columnWidths = [
    { wch: 15 }, // categoria
    { wch: 12 }, // codigo
    { wch: 15 }, // codigo_barras
    { wch: 25 }, // nombre
    { wch: 30 }, // descripcion
    { wch: 15 }, // marca
    { wch: 10 }, // unidad
    { wch: 12 }, // precio_compra
    { wch: 12 }, // precio_venta
    { wch: 12 }, // stock_actual
    { wch: 12 }, // stock_minimo
    { wch: 12 }, // stock_maximo
    { wch: 8 },  // activo
  ]
  ws['!cols'] = columnWidths

  // Crear workbook
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Productos')

  // Agregar hoja de instrucciones
  const instrucciones = [
    ['INSTRUCCIONES PARA IMPORTAR PRODUCTOS'],
    [''],
    ['1. Complete la información de cada producto en las columnas correspondientes'],
    ['2. Los campos obligatorios son: nombre, precio_compra, precio_venta'],
    ['3. Las categorías disponibles son:'],
    ...categorias.map(cat => [`   - ${cat.nombre}`]),
    [''],
    ['4. Unidades válidas: unidad, caja, botella, lata, paquete, kg, gramos, litros, ml'],
    ['5. Estado activo: SI o NO'],
    ['6. El precio de venta debe ser mayor al precio de compra'],
    ['7. Si no especifica código, se generará automáticamente'],
    ['8. Guarde el archivo y súbalo en la sección Importar'],
    [''],
    ['NOTAS:'],
    ['• Mantenga el formato de las columnas'],
    ['• No elimine las columnas de ejemplo'],
    ['• Puede agregar tantas filas como productos tenga'],
    ['• Revise los datos antes de importar']
  ]

  const wsInstrucciones = XLSX.utils.aoa_to_sheet(instrucciones)
  wsInstrucciones['!cols'] = [{ wch: 60 }]
  XLSX.utils.book_append_sheet(wb, wsInstrucciones, 'Instrucciones')

  // Descargar archivo
  XLSX.writeFile(wb, 'plantilla_productos_ControlaPos.xlsx')
}

// Exportar inventario completo
export function exportarInventario(productos: ProductoWithCategoria[]): void {
  const datosExport = productos.map(producto => ({
    categoria: producto.categoria?.nombre || 'Sin categoría',
    codigo: producto.codigo || '',
    codigo_barras: producto.codigo_barras || '',
    nombre: producto.nombre,
    descripcion: producto.descripcion || '',
    marca: producto.marca || '',
    unidad: producto.unidad,
    precio_compra: producto.precio_compra,
    precio_venta: producto.precio_venta,
    margen_porcentaje: producto.precio_compra > 0 ? 
      (((producto.precio_venta - producto.precio_compra) / producto.precio_compra) * 100).toFixed(1) + '%' : '0%',
    ganancia_unitaria: producto.precio_venta - producto.precio_compra,
    stock_actual: producto.stock_actual,
    stock_minimo: producto.stock_minimo,
    stock_maximo: producto.stock_maximo,
    valor_inventario: producto.precio_compra * producto.stock_actual,
    valor_venta_total: producto.precio_venta * producto.stock_actual,
    estado_stock: producto.stock_actual === 0 ? 'Sin Stock' : 
                  producto.stock_actual <= producto.stock_minimo ? 'Stock Bajo' : 'Normal',
    activo: producto.activo ? 'SI' : 'NO',
    fecha_creacion: new Date(producto.created_at).toLocaleDateString('es-BO'),
    fecha_actualizacion: new Date(producto.updated_at).toLocaleDateString('es-BO')
  }))

  // Crear worksheet
  const ws = XLSX.utils.json_to_sheet(datosExport)

  // Configurar anchos de columna
  ws['!cols'] = [
    { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 30 }, { wch: 35 },
    { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 15 },
    { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 },
    { wch: 15 }, { wch: 12 }, { wch: 8 }, { wch: 15 }, { wch: 15 }
  ]

  // Crear workbook
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario')

  // Agregar hoja de resumen
  const totalProductos = productos.length
  const productosActivos = productos.filter(p => p.activo).length
  const sinStock = productos.filter(p => p.stock_actual === 0).length
  const stockBajo = productos.filter(p => p.stock_actual > 0 && p.stock_actual <= p.stock_minimo).length
  const valorTotalInventario = productos.reduce((sum, p) => sum + (p.precio_compra * p.stock_actual), 0)
  const valorTotalVenta = productos.reduce((sum, p) => sum + (p.precio_venta * p.stock_actual), 0)

  const resumen = [
    ['RESUMEN DEL INVENTARIO'],
    ['Fecha de exportación:', new Date().toLocaleDateString('es-BO')],
    [''],
    ['ESTADÍSTICAS GENERALES:'],
    ['Total de productos:', totalProductos],
    ['Productos activos:', productosActivos],
    ['Productos inactivos:', totalProductos - productosActivos],
    [''],
    ['ESTADO DEL STOCK:'],
    ['Sin stock:', sinStock],
    ['Stock bajo:', stockBajo],
    ['Stock normal:', totalProductos - sinStock - stockBajo],
    [''],
    ['VALORES:'],
    ['Valor total del inventario (costo):', formatCurrency(valorTotalInventario)],
    ['Valor total a precio de venta:', formatCurrency(valorTotalVenta)],
    ['Ganancia potencial:', formatCurrency(valorTotalVenta - valorTotalInventario)]
  ]

  const wsResumen = XLSX.utils.aoa_to_sheet(resumen)
  wsResumen['!cols'] = [{ wch: 40 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  // Descargar archivo
  const fecha = new Date().toISOString().split('T')[0]
  XLSX.writeFile(wb, `inventario_ControlaPos_${fecha}.xlsx`)
}

// Leer archivo Excel
export function leerArchivoExcel(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        resolve(jsonData)
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsArrayBuffer(file)
  })
}