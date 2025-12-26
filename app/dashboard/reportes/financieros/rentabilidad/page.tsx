// Path: app\dashboard\reportes\financieros\rentabilidad\page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Download, ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react'
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

interface ProductoRentabilidad {
  producto_id: string
  codigo: string
  nombre: string
  categoria: string
  cantidad_vendida: number
  total_vendido: number
  costo_total: number
  utilidad_bruta: number
  margen_porcentaje: number
  numero_ventas: number
}

export default function RentabilidadPage() {
  const { usuario, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [productos, setProductos] = useState<ProductoRentabilidad[]>([])
  const [rangoSeleccionado, setRangoSeleccionado] = useState<RangoFecha>('este-mes')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [verTipo, setVerTipo] = useState<'utilidad' | 'margen'>('utilidad')

  // Inicializar fechas
  useEffect(() => {
    const rango = obtenerRangoFechas(rangoSeleccionado)
    setFechaDesde(rango.desde)
    setFechaHasta(rango.hasta)
  }, [rangoSeleccionado])

  // Cargar datos
  useEffect(() => {
    if (usuario && fechaDesde && fechaHasta) {
      cargarRentabilidad()
    }
  }, [usuario, fechaDesde, fechaHasta])

  async function cargarRentabilidad() {
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
        numero_ventas: number
      }>()

      ventasData?.forEach((detalle: any) => {
        const productoId = detalle.producto_id
        const existing = productosMap.get(productoId) || {
          cantidad_vendida: 0,
          total_vendido: 0,
          costo_total: 0,
          numero_ventas: 0
        }

        existing.cantidad_vendida += detalle.cantidad
        existing.total_vendido += parseFloat(detalle.subtotal)
        existing.costo_total += detalle.cantidad * parseFloat(detalle.costo_unitario || 0)
        existing.numero_ventas += 1

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

      // Combinar datos
      const productosRentabilidad: ProductoRentabilidad[] = productosInfo?.map((p: any) => {
        const stats = productosMap.get(p.id)!
        const utilidadBruta = stats.total_vendido - stats.costo_total
        const margenPorcentaje = stats.costo_total > 0 
          ? (utilidadBruta / stats.costo_total) * 100 
          : 0

        return {
          producto_id: p.id,
          codigo: p.codigo,
          nombre: p.nombre,
          categoria: p.categoria?.nombre || 'Sin categoría',
          cantidad_vendida: stats.cantidad_vendida,
          total_vendido: stats.total_vendido,
          costo_total: stats.costo_total,
          utilidad_bruta: utilidadBruta,
          margen_porcentaje: margenPorcentaje,
          numero_ventas: stats.numero_ventas
        }
      }) || []

      // Ordenar por utilidad (descendente)
      productosRentabilidad.sort((a, b) => b.utilidad_bruta - a.utilidad_bruta)

      setProductos(productosRentabilidad)
    } catch (error) {
      console.error('Error cargando rentabilidad:', error)
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
      'Total Vendido (Bs.)': p.total_vendido,
      'Costo Total (Bs.)': p.costo_total,
      'Utilidad Bruta (Bs.)': p.utilidad_bruta,
      'Margen %': p.margen_porcentaje,
      'Número de Ventas': p.numero_ventas
    }))

    const datosLimpios = prepararDatosParaExcel(datosExcel)

    exportarAExcel(
      datosLimpios,
      'Rentabilidad por Producto',
      `rentabilidad-${fechaDesde}-${fechaHasta}`
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
    utilidad: p.utilidad_bruta,
    margen: p.margen_porcentaje
  }))

  const totalVendido = productos.reduce((sum, p) => sum + p.total_vendido, 0)
  const totalCosto = productos.reduce((sum, p) => sum + p.costo_total, 0)
  const totalUtilidad = productos.reduce((sum, p) => sum + p.utilidad_bruta, 0)
  const margenPromedio = totalCosto > 0 ? (totalUtilidad / totalCosto) * 100 : 0

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
              <h1 className="text-xl font-bold text-gray-900">💵 Rentabilidad por Producto</h1>
              <p className="text-sm text-gray-600">Ganancias netas por producto</p>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-col gap-3 mt-4">
            {/* Ver por */}
            <div className="flex gap-2">
              <button
                onClick={() => setVerTipo('utilidad')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  verTipo === 'utilidad'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Por Utilidad (Bs.)
              </button>
              <button
                onClick={() => setVerTipo('margen')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  verTipo === 'margen'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Por Margen (%)
              </button>
            </div>

            {/* Rango de fechas */}
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

            {/* Fechas personalizadas */}
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
            {/* Resumen */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-sm text-gray-600">Total Vendido</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatearMoneda(totalVendido)}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-sm text-gray-600">Costo Total</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatearMoneda(totalCosto)}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border-2 border-emerald-200">
                <p className="text-sm text-gray-600">Utilidad Bruta</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatearMoneda(totalUtilidad)}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-sm text-gray-600">Margen Promedio</p>
                <p className="text-2xl font-bold text-amber-600">
                  {formatearPorcentaje(margenPromedio)}
                </p>
              </div>
            </div>

            {/* Gráfica */}
            <div className="bg-white rounded-xl p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">
                  📊 Top 10 Productos {verTipo === 'utilidad' ? 'por Utilidad' : 'por Margen'}
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
                      formatter={(value: any, name?: string) => {
                        if (name === 'utilidad') return [formatearMoneda(value), 'Utilidad']
                        if (name === 'margen') return [`${value.toFixed(1)}%`, 'Margen']
                        return [value]
                      }}
                    />
                    <Legend />
                    {verTipo === 'utilidad' ? (
                      <Bar dataKey="utilidad" name="Utilidad (Bs.)" radius={[0, 8, 8, 0]} fill={COLORES_GRAFICAS.principal} />
                    ) : (
                      <Bar dataKey="margen" name="Margen (%)" radius={[0, 8, 8, 0]} fill={COLORES_GRAFICAS.secundario} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        Producto
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                        Vendido
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">
                        Total
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">
                        Costo
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                        Utilidad
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                        Margen
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {productos.map((producto, index) => (
                      <tr key={producto.producto_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-semibold text-sm">
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{producto.nombre}</p>
                            <p className="text-sm text-gray-500">{producto.codigo}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-gray-900">
                          {producto.cantidad_vendida}
                        </td>
                        <td className="px-4 py-3 text-right text-blue-600 font-medium hidden md:table-cell">
                          {formatearMoneda(producto.total_vendido)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 hidden lg:table-cell">
                          {formatearMoneda(producto.costo_total)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold">
                          <span className={producto.utilidad_bruta >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                            {formatearMoneda(producto.utilidad_bruta)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            producto.margen_porcentaje >= 50
                              ? 'bg-emerald-100 text-emerald-700'
                              : producto.margen_porcentaje >= 20
                              ? 'bg-blue-100 text-blue-700'
                              : producto.margen_porcentaje >= 0
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {producto.margen_porcentaje >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {formatearPorcentaje(producto.margen_porcentaje)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Info */}
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">💡 Interpretación</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>Utilidad Bruta:</strong> Ganancia antes de gastos operativos (Venta - Costo)</li>
                <li>• <strong>Margen:</strong> Porcentaje de ganancia sobre el costo</li>
                <li>• <strong>🟢 Margen ≥50%:</strong> Excelente rentabilidad</li>
                <li>• <strong>🔵 Margen 20-50%:</strong> Buena rentabilidad</li>
                <li>• <strong>🟡 Margen 0-20%:</strong> Baja rentabilidad</li>
                <li>• <strong>🔴 Margen negativo:</strong> Pérdida (revisar precios)</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  )
}