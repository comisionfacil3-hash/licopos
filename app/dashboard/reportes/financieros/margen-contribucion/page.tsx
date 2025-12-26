// Path: app\dashboard\reportes\financieros\margen-contribucion\page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Download, ArrowLeft, TrendingUp, Info } from 'lucide-react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  Legend
} from 'recharts'
import {
  obtenerRangoFechas,
  exportarAExcel,
  prepararDatosParaExcel,
  formatearMoneda,
  formatearPorcentaje,
  RangoFecha,
  COLORES_GRAFICAS
} from '@/lib/utils/reportes'

interface ProductoMargen {
  producto_id: string
  codigo: string
  nombre: string
  categoria: string
  cantidad_vendida: number
  precio_venta_promedio: number
  costo_unitario_promedio: number
  total_vendido: number
  costo_total: number
  margen_contribucion_unitario: number
  margen_contribucion_total: number
  margen_contribucion_porcentaje: number
  razon_contribucion: number
}

export default function MargenContribucionPage() {
  const { usuario, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [productos, setProductos] = useState<ProductoMargen[]>([])
  const [rangoSeleccionado, setRangoSeleccionado] = useState<RangoFecha>('este-mes')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  // Inicializar fechas
  useEffect(() => {
    const rango = obtenerRangoFechas(rangoSeleccionado)
    setFechaDesde(rango.desde)
    setFechaHasta(rango.hasta)
  }, [rangoSeleccionado])

  // Cargar datos
  useEffect(() => {
    if (usuario && fechaDesde && fechaHasta) {
      cargarMargenContribucion()
    }
  }, [usuario, fechaDesde, fechaHasta])

  async function cargarMargenContribucion() {
    try {
      setLoading(true)

      // Obtener ventas del período
      const { data: ventasData, error } = await supabase
        .from('venta_detalles')
        .select(`
          producto_id,
          cantidad,
          precio_unitario,
          costo_unitario,
          subtotal,
          venta:ventas!inner (
            created_at,
            estado,
            sucursal_id
          )
        `)
        .eq('venta.estado', 'completada')
        .eq('venta.sucursal_id', usuario?.sucursal_id)
        .gte('venta.created_at', `${fechaDesde}T00:00:00`)
        .lte('venta.created_at', `${fechaHasta}T23:59:59`)

      if (error) throw error

      // Agrupar por producto
      const productosMap = new Map<string, {
        cantidad_vendida: number
        total_vendido: number
        costo_total: number
        precios_venta: number[]
        costos_unitarios: number[]
      }>()

      ventasData?.forEach((detalle: any) => {
        const productoId = detalle.producto_id
        const existing = productosMap.get(productoId) || {
          cantidad_vendida: 0,
          total_vendido: 0,
          costo_total: 0,
          precios_venta: [],
          costos_unitarios: []
        }

        existing.cantidad_vendida += detalle.cantidad
        existing.total_vendido += parseFloat(detalle.subtotal)
        existing.costo_total += detalle.cantidad * parseFloat(detalle.costo_unitario || 0)
        existing.precios_venta.push(parseFloat(detalle.precio_unitario))
        existing.costos_unitarios.push(parseFloat(detalle.costo_unitario || 0))

        productosMap.set(productoId, existing)
      })

      // Obtener información de productos
      const productosIds = Array.from(productosMap.keys())
      
      if (productosIds.length === 0) {
        setProductos([])
        setLoading(false)
        return
      }

      const { data: productosInfo, error: errorProductos } = await supabase
        .from('productos')
        .select(`
          id,
          codigo,
          nombre,
          categoria:categorias(nombre)
        `)
        .in('id', productosIds)

      if (errorProductos) throw errorProductos

      // Calcular margen de contribución
      const productosMargen: ProductoMargen[] = productosInfo?.map((p: any) => {
        const stats = productosMap.get(p.id)!
        
        // Promedios
        const precioVentaPromedio = stats.precios_venta.reduce((a, b) => a + b, 0) / stats.precios_venta.length
        const costoUnitarioPromedio = stats.costos_unitarios.reduce((a, b) => a + b, 0) / stats.costos_unitarios.length
        
        // Margen de contribución unitario = Precio Venta - Costo Variable Unitario
        const margenContribucionUnitario = precioVentaPromedio - costoUnitarioPromedio
        
        // Margen de contribución total = Total Vendido - Costo Total
        const margenContribucionTotal = stats.total_vendido - stats.costo_total
        
        // Margen de contribución % = (Margen Contribución / Precio Venta) * 100
        const margenContribucionPorcentaje = precioVentaPromedio > 0 
          ? (margenContribucionUnitario / precioVentaPromedio) * 100 
          : 0
        
        // Razón de contribución = Margen Contribución Total / Total Vendido
        const razonContribucion = stats.total_vendido > 0 
          ? (margenContribucionTotal / stats.total_vendido) * 100 
          : 0

        return {
          producto_id: p.id,
          codigo: p.codigo,
          nombre: p.nombre,
          categoria: p.categoria?.nombre || 'Sin categoría',
          cantidad_vendida: stats.cantidad_vendida,
          precio_venta_promedio: precioVentaPromedio,
          costo_unitario_promedio: costoUnitarioPromedio,
          total_vendido: stats.total_vendido,
          costo_total: stats.costo_total,
          margen_contribucion_unitario: margenContribucionUnitario,
          margen_contribucion_total: margenContribucionTotal,
          margen_contribucion_porcentaje: margenContribucionPorcentaje,
          razon_contribucion: razonContribucion
        }
      }) || []

      // Ordenar por margen de contribución total (descendente)
      productosMargen.sort((a, b) => b.margen_contribucion_total - a.margen_contribucion_total)

      setProductos(productosMargen)
    } catch (error) {
      console.error('Error cargando margen contribución:', error)
    } finally {
      setLoading(false)
    }
  }

  function exportarExcel() {
    const datosExcel = productos.map((p, index) => ({
      'Posición': index + 1,
      'Código': p.codigo,
      'Producto': p.nombre,
      'Categoría': p.categoria,
      'Cantidad Vendida': p.cantidad_vendida,
      'Precio Venta Prom. (Bs.)': p.precio_venta_promedio,
      'Costo Variable Prom. (Bs.)': p.costo_unitario_promedio,
      'Margen Contribución Unit. (Bs.)': p.margen_contribucion_unitario,
      'Total Vendido (Bs.)': p.total_vendido,
      'Margen Contribución Total (Bs.)': p.margen_contribucion_total,
      'Margen Contribución %': p.margen_contribucion_porcentaje,
      'Razón Contribución %': p.razon_contribucion
    }))

    const datosLimpios = prepararDatosParaExcel(datosExcel)

    exportarAExcel(
      datosLimpios,
      'Margen de Contribución',
      `margen-contribucion-${fechaDesde}-${fechaHasta}`
    )
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  if (!usuario) {
    router.push('/login')
    return null
  }

  // Preparar datos para gráfica (top 10)
  const productosParaGrafica = productos.slice(0, 10).map(p => ({
    nombre: p.nombre.length > 20 ? p.nombre.substring(0, 20) + '...' : p.nombre,
    margen: p.margen_contribucion_total
  }))

  const totalVendido = productos.reduce((sum, p) => sum + p.total_vendido, 0)
  const totalCostoVariable = productos.reduce((sum, p) => sum + p.costo_total, 0)
  const margenContribucionTotal = productos.reduce((sum, p) => sum + p.margen_contribucion_total, 0)
  const razonContribucionGlobal = totalVendido > 0 ? (margenContribucionTotal / totalVendido) * 100 : 0

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-8">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => router.push('/dashboard/reportes')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">💰 Margen de Contribución</h1>
              <p className="text-sm text-gray-600">Aporte de cada producto a costos fijos</p>
            </div>
          </div>

          {/* Filtros de fecha */}
          <div className="flex flex-col gap-3 mt-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {(['hoy', 'ayer', 'ultimos-7', 'ultimos-30', 'este-mes', 'mes-anterior'] as RangoFecha[]).map((rango) => (
                <button
                  key={rango}
                  onClick={() => setRangoSeleccionado(rango)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    rangoSeleccionado === rango
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {rango === 'hoy' && 'Hoy'}
                  {rango === 'ayer' && 'Ayer'}
                  {rango === 'ultimos-7' && 'Últimos 7 días'}
                  {rango === 'ultimos-30' && 'Últimos 30 días'}
                  {rango === 'este-mes' && 'Este mes'}
                  {rango === 'mes-anterior' && 'Mes anterior'}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Desde</label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => {
                    setFechaDesde(e.target.value)
                    setRangoSeleccionado('personalizado')
                  }}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Hasta</label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => {
                    setFechaHasta(e.target.value)
                    setRangoSeleccionado('personalizado')
                  }}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4 max-w-7xl mx-auto">
        {productos.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No hay ventas en este período
            </h3>
            <p className="text-gray-600">
              Intenta seleccionar un rango de fechas diferente
            </p>
          </div>
        ) : (
          <>
            {/* Resumen Global */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-sm text-gray-600">Ventas Totales</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatearMoneda(totalVendido)}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-sm text-gray-600">Costos Variables</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatearMoneda(totalCostoVariable)}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border-2 border-emerald-200">
                <p className="text-sm text-gray-600">Margen Contribución</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatearMoneda(margenContribucionTotal)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Para cubrir costos fijos</p>
              </div>
              <div className="bg-white p-4 rounded-lg border-2 border-amber-200">
                <p className="text-sm text-gray-600">Razón Contribución</p>
                <p className="text-2xl font-bold text-amber-600">
                  {formatearPorcentaje(razonContribucionGlobal)}
                </p>
                <p className="text-xs text-gray-500 mt-1">De cada venta</p>
              </div>
            </div>

            {/* Info explicativa */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-blue-900 mb-1">¿Qué es el Margen de Contribución?</h3>
                  <p className="text-sm text-blue-800">
                    Es el dinero que cada producto aporta para cubrir los <strong>costos fijos</strong> (alquiler, servicios, sueldos) 
                    después de cubrir sus <strong>costos variables</strong> (precio de compra del producto). 
                    Un margen alto significa que el producto ayuda más a pagar los gastos fijos.
                  </p>
                </div>
              </div>
            </div>

            {/* Gráfica */}
            <div className="bg-white rounded-xl p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">
                  📊 Top 10 Productos por Margen de Contribución
                </h2>
                <button
                  onClick={exportarExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg 
                           hover:bg-emerald-700 transition-colors text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Exportar Excel</span>
                </button>
              </div>

              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productosParaGrafica} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis 
                      dataKey="nombre" 
                      type="category" 
                      width={150}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      formatter={(value: any) => [formatearMoneda(value), 'Margen Contribución']}
                    />
                    <Legend />
                    <Bar dataKey="margen" name="Margen Contribución (Bs.)" radius={[0, 8, 8, 0]}>
                      {productosParaGrafica.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.margen >= 0 ? COLORES_GRAFICAS.principal : COLORES_GRAFICAS.peligro} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tabla detallada */}
            <div className="bg-white rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        #
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        Producto
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                        Vendido
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">
                        P. Venta
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">
                        Costo Var.
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                        MC Unit.
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                        MC Total
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                        Razón
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {productos.map((producto, index) => (
                      <tr key={producto.producto_id} className="hover:bg-gray-50">
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 font-semibold text-xs">
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{producto.nombre}</p>
                            <p className="text-xs text-gray-500">{producto.codigo}</p>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center font-semibold text-gray-900">
                          {producto.cantidad_vendida}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-600 hidden md:table-cell">
                          {formatearMoneda(producto.precio_venta_promedio)}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-600 hidden md:table-cell">
                          {formatearMoneda(producto.costo_unitario_promedio)}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-blue-600">
                          {formatearMoneda(producto.margen_contribucion_unitario)}
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-emerald-600">
                          {formatearMoneda(producto.margen_contribucion_total)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                            producto.razon_contribucion >= 50
                              ? 'bg-emerald-100 text-emerald-700'
                              : producto.razon_contribucion >= 30
                              ? 'bg-blue-100 text-blue-700'
                              : producto.razon_contribucion >= 0
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            <TrendingUp className="w-3 h-3" />
                            {formatearPorcentaje(producto.razon_contribucion)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Explicación de conceptos */}
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h3 className="font-semibold text-amber-900 mb-2">💡 Conceptos Clave</h3>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>• <strong>MC Unitario:</strong> Precio Venta - Costo Variable = Aporte por unidad vendida</li>
                <li>• <strong>MC Total:</strong> MC Unitario × Cantidad Vendida = Aporte total del producto</li>
                <li>• <strong>Razón Contribución:</strong> (MC Total / Ventas) × 100 = % que aporta a costos fijos</li>
                <li>• <strong>🟢 Razón ≥50%:</strong> Excelente aporte a costos fijos</li>
                <li>• <strong>🔵 Razón 30-50%:</strong> Buen aporte</li>
                <li>• <strong>🟡 Razón 0-30%:</strong> Bajo aporte</li>
                <li>• <strong>Objetivo:</strong> Priorizar venta de productos con mayor razón de contribución</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  )
}