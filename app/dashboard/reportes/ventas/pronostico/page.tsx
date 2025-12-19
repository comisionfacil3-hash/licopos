'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Download, ArrowLeft, TrendingUp } from 'lucide-react'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  ReferenceLine
} from 'recharts'
import {
  exportarAExcel,
  prepararDatosParaExcel,
  formatearMoneda,
  COLORES_GRAFICAS
} from '@/lib/utils/reportes'

interface ProductoPronostico {
  producto_id: string
  codigo: string
  nombre: string
  categoria: string
  historico: number
  promedio_diario: number
  pronostico_7dias: number
  pronostico_15dias: number
  pronostico_30dias: number
  stock_actual: number
  dias_cobertura: number
  recomendacion_compra_7dias: number
  recomendacion_compra_15dias: number
  recomendacion_compra_30dias: number
}

interface DatoGrafica {
  dia: string
  historico?: number
  proyeccion?: number
}

export default function PronosticoPage() {
  const { usuario, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [productos, setProductos] = useState<ProductoPronostico[]>([])
  const [productoSeleccionado, setProductoSeleccionado] = useState<string | null>(null)
  const [datosGrafica, setDatosGrafica] = useState<DatoGrafica[]>([])
  const [diasHistorico, setDiasHistorico] = useState(30)

  useEffect(() => {
    if (usuario) {
      cargarPronostico()
    }
  }, [usuario, diasHistorico])

  async function cargarPronostico() {
    try {
      setLoading(true)

      // Calcular fecha inicio
      const fechaHasta = new Date()
      const fechaDesde = new Date()
      fechaDesde.setDate(fechaDesde.getDate() - diasHistorico)

      // Obtener ventas del período
      const { data: ventasData, error } = await supabase
        .from('venta_detalles')
        .select(`
          producto_id,
          cantidad,
          venta:ventas!inner (
            created_at,
            estado,
            sucursal_id
          )
        `)
        .eq('venta.estado', 'completada')
        .eq('venta.sucursal_id', usuario?.sucursal_id)
        .gte('venta.created_at', fechaDesde.toISOString())
        .lte('venta.created_at', fechaHasta.toISOString())

      if (error) throw error

      // Obtener productos
      const { data: productosData, error: errorProductos } = await supabase
        .from('productos')
        .select('id, codigo, nombre, stock_actual, categoria:categorias(nombre)')
        .eq('sucursal_id', usuario?.sucursal_id)
        .eq('activo', true)

      if (errorProductos) throw errorProductos

      // Agrupar ventas por producto
      const ventasPorProducto = new Map<string, number>()
      ventasData?.forEach((vd: any) => {
        const actual = ventasPorProducto.get(vd.producto_id) || 0
        ventasPorProducto.set(vd.producto_id, actual + vd.cantidad)
      })

      // Calcular pronósticos
      const pronosticos: ProductoPronostico[] = productosData?.map((producto: any) => {
        const totalVendido = ventasPorProducto.get(producto.id) || 0
        const promedioDiario = totalVendido / diasHistorico

        const pronostico7 = Math.ceil(promedioDiario * 7)
        const pronostico15 = Math.ceil(promedioDiario * 15)
        const pronostico30 = Math.ceil(promedioDiario * 30)

        const diasCobertura = promedioDiario > 0 
          ? Math.floor(producto.stock_actual / promedioDiario)
          : 999

        const recomendacion7 = Math.max(0, pronostico7 - producto.stock_actual)
        const recomendacion15 = Math.max(0, pronostico15 - producto.stock_actual)
        const recomendacion30 = Math.max(0, pronostico30 - producto.stock_actual)

        return {
          producto_id: producto.id,
          codigo: producto.codigo,
          nombre: producto.nombre,
          categoria: producto.categoria?.nombre || 'Sin categoría',
          historico: totalVendido,
          promedio_diario: promedioDiario,
          pronostico_7dias: pronostico7,
          pronostico_15dias: pronostico15,
          pronostico_30dias: pronostico30,
          stock_actual: producto.stock_actual,
          dias_cobertura: diasCobertura,
          recomendacion_compra_7dias: recomendacion7,
          recomendacion_compra_15dias: recomendacion15,
          recomendacion_compra_30dias: recomendacion30
        }
      }) || []

      // Ordenar por promedio diario descendente
      pronosticos.sort((a, b) => b.promedio_diario - a.promedio_diario)

      setProductos(pronosticos)

      // Si hay productos, seleccionar el primero por defecto
      if (pronosticos.length > 0 && !productoSeleccionado) {
        setProductoSeleccionado(pronosticos[0].producto_id)
      }
    } catch (error) {
      console.error('Error cargando pronóstico:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (productoSeleccionado) {
      generarDatosGrafica()
    }
  }, [productoSeleccionado, productos])

  async function generarDatosGrafica() {
    const producto = productos.find(p => p.producto_id === productoSeleccionado)
    if (!producto) return

    // Obtener ventas diarias del producto
    const fechaHasta = new Date()
    const fechaDesde = new Date()
    fechaDesde.setDate(fechaDesde.getDate() - diasHistorico)

    const { data: ventasData } = await supabase
      .from('venta_detalles')
      .select(`
        cantidad,
        venta:ventas!inner (
          created_at,
          estado,
          sucursal_id
        )
      `)
      .eq('producto_id', productoSeleccionado)
      .eq('venta.estado', 'completada')
      .eq('venta.sucursal_id', usuario?.sucursal_id)
      .gte('venta.created_at', fechaDesde.toISOString())
      .lte('venta.created_at', fechaHasta.toISOString())

    // Agrupar por día
    const ventasPorDia = new Map<string, number>()
    ventasData?.forEach((vd: any) => {
      const fecha = new Date(vd.venta.created_at).toLocaleDateString('es-BO', { 
        day: '2-digit', 
        month: 'short' 
      })
      const actual = ventasPorDia.get(fecha) || 0
      ventasPorDia.set(fecha, actual + vd.cantidad)
    })

    // Generar datos históricos
    const datos: DatoGrafica[] = []
    for (let i = diasHistorico; i > 0; i--) {
      const fecha = new Date()
      fecha.setDate(fecha.getDate() - i)
      const fechaStr = fecha.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })
      datos.push({
        dia: fechaStr,
        historico: ventasPorDia.get(fechaStr) || 0
      })
    }

    // Agregar proyección
    for (let i = 1; i <= 30; i++) {
      const fecha = new Date()
      fecha.setDate(fecha.getDate() + i)
      const fechaStr = fecha.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })
      datos.push({
        dia: fechaStr,
        proyeccion: Math.round(producto.promedio_diario)
      })
    }

    setDatosGrafica(datos)
  }

  function exportarExcel() {
    const datosExcel = productos.map((p) => ({
      'Código': p.codigo,
      'Producto': p.nombre,
      'Categoría': p.categoria,
      'Vendido (últimos días)': p.historico,
      'Promedio Diario': p.promedio_diario.toFixed(2),
      'Pronóstico 7 días': p.pronostico_7dias,
      'Pronóstico 15 días': p.pronostico_15dias,
      'Pronóstico 30 días': p.pronostico_30dias,
      'Stock Actual': p.stock_actual,
      'Días de Cobertura': p.dias_cobertura === 999 ? 'N/A' : p.dias_cobertura,
      'Comprar para 7 días': p.recomendacion_compra_7dias,
      'Comprar para 15 días': p.recomendacion_compra_15dias,
      'Comprar para 30 días': p.recomendacion_compra_30dias
    }))

    const datosLimpios = prepararDatosParaExcel(datosExcel)
    exportarAExcel(datosLimpios, 'Pronóstico de Demanda', `pronostico-${diasHistorico}dias`)
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

  const productoActual = productos.find(p => p.producto_id === productoSeleccionado)

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
              <h1 className="text-xl font-bold text-gray-900">🔮 Pronóstico de Demanda</h1>
              <p className="text-sm text-gray-600">Proyección de necesidades de inventario</p>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex gap-2 overflow-x-auto pb-2 mt-4">
            {[7, 15, 30, 60, 90].map((dias) => (
              <button
                key={dias}
                onClick={() => setDiasHistorico(dias)}
                className={`
                  px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                  ${diasHistorico === dias
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                Últimos {dias} días
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4 max-w-7xl mx-auto">
        {productos.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">🔮</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No hay datos suficientes
            </h3>
            <p className="text-gray-600">
              Necesitas tener ventas registradas para generar pronósticos
            </p>
          </div>
        ) : (
          <>
            {/* Botón exportar */}
            <div className="flex justify-end mb-4">
              <button
                onClick={exportarExcel}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg 
                         hover:bg-emerald-700 transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Exportar Excel
              </button>
            </div>

            {/* Gráfica de producto seleccionado */}
            {productoActual && datosGrafica.length > 0 && (
              <div className="bg-white rounded-xl p-6 mb-4">
                <div className="mb-4">
                  <h2 className="font-semibold text-gray-900 mb-2">
                    📊 Proyección: {productoActual.nombre}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm px-2 py-1 bg-blue-100 text-blue-700 rounded">
                      Stock: {productoActual.stock_actual} unidades
                    </span>
                    <span className="text-sm px-2 py-1 bg-emerald-100 text-emerald-700 rounded">
                      Promedio: {productoActual.promedio_diario.toFixed(1)} und/día
                    </span>
                    <span className={`text-sm px-2 py-1 rounded ${
                      productoActual.dias_cobertura < 7 
                        ? 'bg-red-100 text-red-700'
                        : productoActual.dias_cobertura < 15
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      Cobertura: {productoActual.dias_cobertura === 999 ? 'N/A' : `${productoActual.dias_cobertura} días`}
                    </span>
                  </div>
                </div>

                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={datosGrafica}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="dia" 
                        tick={{ fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <ReferenceLine 
                        x={datosGrafica[diasHistorico]?.dia} 
                        stroke="red" 
                        label="Hoy" 
                        strokeDasharray="3 3"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="historico" 
                        stroke={COLORES_GRAFICAS.principal}
                        strokeWidth={2}
                        name="Histórico"
                        dot={{ r: 2 }}
                        connectNulls
                      />
                      <Line 
                        type="monotone" 
                        dataKey="proyeccion" 
                        stroke={COLORES_GRAFICAS.peligro}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        name="Proyección"
                        dot={false}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Tabla de productos */}
            <div className="bg-white rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        Producto
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                        Promedio/Día
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                        Stock
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">
                        Cobertura
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                        Comprar (7d)
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">
                        Comprar (15d)
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase hidden xl:table-cell">
                        Comprar (30d)
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                        Ver
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {productos.map((producto) => (
                      <tr 
                        key={producto.producto_id} 
                        className={`hover:bg-gray-50 ${
                          producto.producto_id === productoSeleccionado ? 'bg-emerald-50' : ''
                        }`}
                      >
                        <td className="px-3 py-3">
                          <div className="font-medium text-gray-900">{producto.nombre}</div>
                          <div className="text-xs text-gray-500">{producto.codigo}</div>
                        </td>
                        <td className="px-3 py-3 text-right text-gray-900">
                          {producto.promedio_diario.toFixed(1)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className={`font-semibold ${
                            producto.stock_actual === 0 ? 'text-red-600' : 'text-gray-900'
                          }`}>
                            {producto.stock_actual}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right hidden md:table-cell">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            producto.dias_cobertura < 7
                              ? 'bg-red-100 text-red-700'
                              : producto.dias_cobertura < 15
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {producto.dias_cobertura === 999 ? 'N/A' : `${producto.dias_cobertura}d`}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className={`font-semibold ${
                            producto.recomendacion_compra_7dias > 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {producto.recomendacion_compra_7dias > 0 ? producto.recomendacion_compra_7dias : '✓'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right hidden lg:table-cell">
                          <span className={`font-semibold ${
                            producto.recomendacion_compra_15dias > 0 ? 'text-amber-600' : 'text-green-600'
                          }`}>
                            {producto.recomendacion_compra_15dias > 0 ? producto.recomendacion_compra_15dias : '✓'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right hidden xl:table-cell">
                          <span className={`font-semibold ${
                            producto.recomendacion_compra_30dias > 0 ? 'text-orange-600' : 'text-green-600'
                          }`}>
                            {producto.recomendacion_compra_30dias > 0 ? producto.recomendacion_compra_30dias : '✓'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => setProductoSeleccionado(producto.producto_id)}
                            className={`p-1 rounded transition-colors ${
                              producto.producto_id === productoSeleccionado
                                ? 'bg-emerald-600 text-white'
                                : 'hover:bg-gray-200 text-gray-600'
                            }`}
                          >
                            <TrendingUp className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Info */}
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">💡 ¿Cómo interpretar?</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>Promedio/Día:</strong> Unidades vendidas promedio por día</li>
                <li>• <strong>Cobertura:</strong> Días que durará tu stock actual</li>
                <li>• <strong>Comprar:</strong> Unidades que necesitas comprar para cubrir ese período</li>
                <li>• <strong>✓ Verde:</strong> Tienes suficiente stock</li>
                <li>• <strong>Número Rojo:</strong> Cantidad recomendada a comprar</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  )
}