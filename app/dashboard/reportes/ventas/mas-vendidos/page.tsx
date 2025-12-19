'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  Download, 
  ArrowLeft
} from 'lucide-react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts'
import {
  obtenerRangoFechas,
  exportarAExcel,
  prepararDatosParaExcel,
  formatearMoneda,
  RangoFecha,
  COLORES_GRAFICAS
} from '@/lib/utils/reportes'

interface ProductoVendido {
  producto_id: string
  codigo: string
  nombre: string
  categoria: string
  cantidad_vendida: number
  total_vendido: number
  numero_ventas: number
  precio_promedio: number
}

export default function MasVendidosPage() {
  const { usuario, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [productos, setProductos] = useState<ProductoVendido[]>([])
  const [rangoSeleccionado, setRangoSeleccionado] = useState<RangoFecha>('este-mes')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [verTop, setVerTop] = useState<'mas' | 'menos'>('mas')
  const [limiteMostrar, setLimiteMostrar] = useState(10)

  // Inicializar fechas
  useEffect(() => {
    const rango = obtenerRangoFechas(rangoSeleccionado)
    setFechaDesde(rango.desde)
    setFechaHasta(rango.hasta)
  }, [rangoSeleccionado])

  // Cargar datos
  useEffect(() => {
    if (usuario && fechaDesde && fechaHasta) {
      cargarProductosVendidos()
    }
  }, [usuario, fechaDesde, fechaHasta])

  async function cargarProductosVendidos() {
    try {
      setLoading(true)

      // Query para obtener productos vendidos
      const { data: ventasData, error } = await supabase
        .from('venta_detalles')
        .select(`
          producto_id,
          cantidad,
          precio_unitario,
          subtotal,
          venta:ventas!inner (
            created_at,
            estado,
            sucursal_id
          )
        `)
        .eq('venta.estado', 'completada')
        .gte('venta.created_at', `${fechaDesde}T00:00:00`)
        .lte('venta.created_at', `${fechaHasta}T23:59:59`)
        .eq('venta.sucursal_id', usuario?.sucursal_id)

      if (error) throw error

      // Agrupar por producto
      const productosMap = new Map<string, {
        cantidad_vendida: number
        total_vendido: number
        numero_ventas: number
        precios: number[]
      }>()

      ventasData?.forEach((detalle: any) => {
        const productoId = detalle.producto_id
        const existing = productosMap.get(productoId) || {
          cantidad_vendida: 0,
          total_vendido: 0,
          numero_ventas: 0,
          precios: []
        }

        existing.cantidad_vendida += detalle.cantidad
        existing.total_vendido += parseFloat(detalle.subtotal)
        existing.numero_ventas += 1
        existing.precios.push(parseFloat(detalle.precio_unitario))

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
      const productosCompletos: ProductoVendido[] = productosInfo?.map((p: any) => {
        const stats = productosMap.get(p.id)!
        const precioPromedio = stats.precios.reduce((a, b) => a + b, 0) / stats.precios.length

        return {
          producto_id: p.id,
          codigo: p.codigo,
          nombre: p.nombre,
          categoria: p.categoria?.nombre || 'Sin categoría',
          cantidad_vendida: stats.cantidad_vendida,
          total_vendido: stats.total_vendido,
          numero_ventas: stats.numero_ventas,
          precio_promedio: precioPromedio
        }
      }) || []

      // Ordenar por cantidad vendida (descendente para más vendidos)
      productosCompletos.sort((a, b) => b.cantidad_vendida - a.cantidad_vendida)

      setProductos(productosCompletos)
    } catch (error) {
      console.error('Error cargando productos:', error)
    } finally {
      setLoading(false)
    }
  }

  function exportarExcel() {
    const productosParaExcel = productos.slice(0, limiteMostrar).map((p, index) => ({
      'Posición': index + 1,
      'Código': p.codigo,
      'Producto': p.nombre,
      'Categoría': p.categoria,
      'Cantidad Vendida': p.cantidad_vendida,
      'Total Vendido (Bs.)': p.total_vendido,
      'Número de Ventas': p.numero_ventas,
      'Precio Promedio (Bs.)': p.precio_promedio
    }))

    const datosLimpios = prepararDatosParaExcel(productosParaExcel)

    exportarAExcel(
      datosLimpios,
      'Productos Más Vendidos',
      `productos-${verTop}-vendidos-${fechaDesde}-${fechaHasta}`
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

  // Preparar datos para gráfica
  const productosParaGrafica = (verTop === 'mas' 
    ? productos.slice(0, limiteMostrar)
    : productos.slice().reverse().slice(0, limiteMostrar)
  ).map((p, index) => ({
    nombre: p.nombre.length > 20 ? p.nombre.substring(0, 20) + '...' : p.nombre,
    cantidad: p.cantidad_vendida,
    total: p.total_vendido
  }))

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
              <h1 className="text-xl font-bold text-gray-900">
                📊 Productos Más/Menos Vendidos
              </h1>
              <p className="text-sm text-gray-600">
                Ranking por volumen de ventas
              </p>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-col gap-3 mt-4">
            {/* Toggle Más/Menos */}
            <div className="flex gap-2">
              <button
                onClick={() => setVerTop('mas')}
                className={`
                  flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors
                  ${verTop === 'mas'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                📈 Más Vendidos
              </button>
              <button
                onClick={() => setVerTop('menos')}
                className={`
                  flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors
                  ${verTop === 'menos'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                📉 Menos Vendidos
              </button>
            </div>

            {/* Rango de fechas */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {(['hoy', 'ayer', 'ultimos-7', 'ultimos-30', 'este-mes', 'mes-anterior'] as RangoFecha[]).map((rango) => (
                <button
                  key={rango}
                  onClick={() => setRangoSeleccionado(rango)}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                    ${rangoSeleccionado === rango
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
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

            {/* Límite a mostrar */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Mostrar top:</span>
              <div className="flex gap-2">
                {[10, 20, 50].map((num) => (
                  <button
                    key={num}
                    onClick={() => setLimiteMostrar(num)}
                    className={`
                      px-3 py-1 rounded-lg text-sm font-medium transition-colors
                      ${limiteMostrar === num
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }
                    `}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4 max-w-7xl mx-auto">
        {productos.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-sm text-gray-600">Total Productos</p>
                <p className="text-2xl font-bold text-gray-900">{productos.length}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-sm text-gray-600">Unidades Vendidas</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {productos.reduce((sum, p) => sum + p.cantidad_vendida, 0)}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border col-span-2">
                <p className="text-sm text-gray-600">Total Vendido</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatearMoneda(productos.reduce((sum, p) => sum + p.total_vendido, 0))}
                </p>
              </div>
            </div>

            {/* Gráfica */}
            <div className="bg-white rounded-xl p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">
                  📊 Top {limiteMostrar} Productos {verTop === 'mas' ? 'Más' : 'Menos'} Vendidos
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
                        if (name === 'cantidad') return [`${value} unidades`, 'Cantidad']
                        if (name === 'total') return [formatearMoneda(value), 'Total']
                        return [value]
                      }}
                    />
                    <Bar dataKey="cantidad" radius={[0, 8, 8, 0]}>
                      {productosParaGrafica.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={verTop === 'mas' ? COLORES_GRAFICAS.principal : COLORES_GRAFICAS.peligro} 
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
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        Producto
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">
                        Categoría
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                        Cantidad
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                        Total
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">
                        Ventas
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(verTop === 'mas' 
                      ? productos.slice(0, limiteMostrar)
                      : productos.slice().reverse().slice(0, limiteMostrar)
                    ).map((producto, index) => (
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
                        <td className="px-4 py-3 text-gray-600 text-sm hidden md:table-cell">
                          {producto.categoria}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold text-gray-900">
                            {producto.cantidad_vendida}
                          </span>
                          <span className="text-sm text-gray-500"> un.</span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                          {formatearMoneda(producto.total_vendido)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 hidden lg:table-cell">
                          {producto.numero_ventas} ventas
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}