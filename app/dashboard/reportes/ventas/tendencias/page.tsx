'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Download, ArrowLeft } from 'lucide-react'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts'
import {
  obtenerRangoFechas,
  exportarAExcel,
  prepararDatosParaExcel,
  formatearMoneda,
  RangoFecha,
  COLORES_GRAFICAS
} from '@/lib/utils/reportes'

interface VentaPorPeriodo {
  periodo: string
  total: number
  cantidad: number
  ventas_count: number
}

type TipoVista = 'dia' | 'semana' | 'mes' | 'hora' | 'dia-semana'

export default function TendenciasPage() {
  const { usuario, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [ventas, setVentas] = useState<VentaPorPeriodo[]>([])
  const [rangoSeleccionado, setRangoSeleccionado] = useState<RangoFecha>('este-mes')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [vistaActiva, setVistaActiva] = useState<TipoVista>('dia')

  // Inicializar fechas
  useEffect(() => {
    const rango = obtenerRangoFechas(rangoSeleccionado)
    setFechaDesde(rango.desde)
    setFechaHasta(rango.hasta)
  }, [rangoSeleccionado])

  // Cargar datos
  useEffect(() => {
    if (usuario && fechaDesde && fechaHasta) {
      cargarTendencias()
    }
  }, [usuario, fechaDesde, fechaHasta, vistaActiva])

  async function cargarTendencias() {
    try {
      setLoading(true)

      const { data: ventasData, error } = await supabase
        .from('ventas')
        .select('created_at, total')
        .eq('sucursal_id', usuario?.sucursal_id)
        .eq('estado', 'completada')
        .gte('created_at', `${fechaDesde}T00:00:00`)
        .lte('created_at', `${fechaHasta}T23:59:59`)
        .order('created_at', { ascending: true })

      if (error) throw error

      const ventasAgrupadas = agruparVentas(ventasData || [])
      setVentas(ventasAgrupadas)
    } catch (error) {
      console.error('Error cargando tendencias:', error)
    } finally {
      setLoading(false)
    }
  }

  function agruparVentas(ventasData: any[]): VentaPorPeriodo[] {
    const grupos = new Map<string, { total: number; cantidad: number; count: number }>()

    ventasData.forEach((venta) => {
      const fecha = new Date(venta.created_at)
      let clave = ''

      switch (vistaActiva) {
        case 'hora':
          clave = `${fecha.getHours()}:00`
          break
        case 'dia':
          clave = fecha.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })
          break
        case 'dia-semana':
          const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
          clave = dias[fecha.getDay()]
          break
        case 'semana':
          const inicio = new Date(fecha)
          inicio.setDate(fecha.getDate() - fecha.getDay())
          clave = `Sem ${inicio.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })}`
          break
        case 'mes':
          clave = fecha.toLocaleDateString('es-BO', { month: 'short', year: 'numeric' })
          break
      }

      const existing = grupos.get(clave) || { total: 0, cantidad: 0, count: 0 }
      existing.total += parseFloat(venta.total)
      existing.cantidad += 1
      existing.count += 1
      grupos.set(clave, existing)
    })

    return Array.from(grupos.entries()).map(([periodo, data]) => ({
      periodo,
      total: data.total,
      cantidad: data.cantidad,
      ventas_count: data.count
    }))
  }

  function exportarExcel() {
    const datosExcel = ventas.map((v) => ({
      'Período': v.periodo,
      'Total Vendido (Bs.)': v.total,
      'Cantidad de Ventas': v.ventas_count
    }))

    const datosLimpios = prepararDatosParaExcel(datosExcel)
    exportarAExcel(
      datosLimpios,
      'Tendencias de Ventas',
      `tendencias-${vistaActiva}-${fechaDesde}-${fechaHasta}`
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

  const totalVentas = ventas.reduce((sum, v) => sum + v.total, 0)
  const totalCantidad = ventas.reduce((sum, v) => sum + v.ventas_count, 0)
  const promedioVenta = totalCantidad > 0 ? totalVentas / totalCantidad : 0

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
              <h1 className="text-xl font-bold text-gray-900">📈 Tendencias de Ventas</h1>
              <p className="text-sm text-gray-600">Patrones temporales de venta</p>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-col gap-3 mt-4">
            {/* Tipo de vista */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {[
                { id: 'hora' as TipoVista, label: '⏰ Por Hora' },
                { id: 'dia' as TipoVista, label: '📅 Por Día' },
                { id: 'dia-semana' as TipoVista, label: '📆 Día Semana' },
                { id: 'semana' as TipoVista, label: '📊 Por Semana' },
                { id: 'mes' as TipoVista, label: '📈 Por Mes' }
              ].map((vista) => (
                <button
                  key={vista.id}
                  onClick={() => setVistaActiva(vista.id)}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                    ${vistaActiva === vista.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  {vista.label}
                </button>
              ))}
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
                      ? 'bg-blue-600 text-white'
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
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4 max-w-7xl mx-auto">
        {ventas.length === 0 ? (
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-sm text-gray-600">Total Vendido</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatearMoneda(totalVentas)}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-sm text-gray-600">Cantidad de Ventas</p>
                <p className="text-2xl font-bold text-blue-600">{totalCantidad}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-sm text-gray-600">Promedio por Venta</p>
                <p className="text-2xl font-bold text-amber-600">
                  {formatearMoneda(promedioVenta)}
                </p>
              </div>
            </div>

            {/* Gráfica */}
            <div className="bg-white rounded-xl p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">
                  📈 Tendencia de Ventas
                  {vistaActiva === 'hora' && ' por Hora'}
                  {vistaActiva === 'dia' && ' por Día'}
                  {vistaActiva === 'dia-semana' && ' por Día de la Semana'}
                  {vistaActiva === 'semana' && ' por Semana'}
                  {vistaActiva === 'mes' && ' por Mes'}
                </h2>
                <button
                  onClick={exportarExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg 
                           hover:bg-emerald-700 transition-colors text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Exportar</span>
                </button>
              </div>

              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ventas}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="periodo" 
                      tick={{ fontSize: 12 }}
                      angle={vistaActiva === 'dia' ? -45 : 0}
                      textAnchor={vistaActiva === 'dia' ? 'end' : 'middle'}
                      height={vistaActiva === 'dia' ? 80 : 50}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: any, name?: string) => {
                        if (name === 'total') return [formatearMoneda(value), 'Total Vendido']
                        if (name === 'ventas_count') return [value, 'Cantidad de Ventas']
                        return [value, name || '']
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="total" 
                      stroke={COLORES_GRAFICAS.principal}
                      strokeWidth={2}
                      name="Total Vendido"
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="ventas_count" 
                      stroke={COLORES_GRAFICAS.secundario}
                      strokeWidth={2}
                      name="Cantidad de Ventas"
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
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
                        Período
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                        Ventas
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                        Total
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">
                        Promedio
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ventas.map((venta, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {venta.periodo}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {venta.ventas_count}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                          {formatearMoneda(venta.total)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 hidden md:table-cell">
                          {formatearMoneda(venta.total / venta.ventas_count)}
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