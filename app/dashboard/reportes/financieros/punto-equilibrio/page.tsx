// Path: app\dashboard\reportes\financieros\punto-equilibrio\page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Download, ArrowLeft, Settings, TrendingUp, AlertCircle, CheckCircle, Info } from 'lucide-react'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Area,
  ComposedChart
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

interface CostosFijos {
  alquiler: number
  servicios: number
  sueldos: number
  otros: number
  total: number
}

interface ProductoAnalisis {
  producto_id: string
  codigo: string
  nombre: string
  cantidad_vendida: number
  precio_venta_promedio: number
  costo_variable_promedio: number
  margen_contribucion_unitario: number
  razon_contribucion: number
  total_vendido: number
  punto_equilibrio_unidades: number
  punto_equilibrio_ventas: number
  contribucion_total: number
}

interface DatoGrafica {
  unidades: number
  costos_fijos: number
  costos_variables: number
  costos_totales: number
  ingresos: number
}

export default function PuntoEquilibrioPage() {
  const { usuario, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [productos, setProductos] = useState<ProductoAnalisis[]>([])
  const [rangoSeleccionado, setRangoSeleccionado] = useState<RangoFecha>('este-mes')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  
  // Costos fijos - SE CARGAN DE LA BD
  const [costosFijos, setCostosFijos] = useState<CostosFijos>({
    alquiler: 0,
    servicios: 0,
    sueldos: 0,
    otros: 0,
    total: 0
  })
  const [costosFijosConfigurados, setCostosFijosConfigurados] = useState(false)

  // Datos del análisis
  const [datosGrafica, setDatosGrafica] = useState<DatoGrafica[]>([])
  const [puntoEquilibrioUnidades, setPuntoEquilibrioUnidades] = useState(0)
  const [puntoEquilibrioVentas, setPuntoEquilibrioVentas] = useState(0)
  const [margenSeguridad, setMargenSeguridad] = useState(0)
  const [margenSeguridadPorcentaje, setMargenSeguridadPorcentaje] = useState(0)
  const [diasParaEquilibrio, setDiasParaEquilibrio] = useState(0)

  // Inicializar fechas
  useEffect(() => {
    const rango = obtenerRangoFechas(rangoSeleccionado)
    setFechaDesde(rango.desde)
    setFechaHasta(rango.hasta)
  }, [rangoSeleccionado])

  // Cargar costos fijos de la BD
  useEffect(() => {
    if (usuario?.sucursal_id) {
      cargarCostosFijos()
    }
  }, [usuario?.sucursal_id])

  // Cargar datos cuando tenemos fechas y costos
  useEffect(() => {
    if (usuario && fechaDesde && fechaHasta && costosFijosConfigurados) {
      cargarAnalisisPuntoEquilibrio()
    }
  }, [usuario, fechaDesde, fechaHasta, costosFijos])

  async function cargarCostosFijos() {
    try {
      const { data: costosData, error } = await supabase
        .from('costos_fijos')
        .select('*')
        .eq('sucursal_id', usuario?.sucursal_id)
        .single()

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned (es normal si aún no configuraron)
        throw error
      }

      if (costosData) {
        const total = 
          parseFloat(costosData.alquiler_mensual) +
          parseFloat(costosData.servicios_mensuales) +
          parseFloat(costosData.sueldos_mensuales) +
          parseFloat(costosData.otros_gastos_mensuales)

        setCostosFijos({
          alquiler: parseFloat(costosData.alquiler_mensual) || 0,
          servicios: parseFloat(costosData.servicios_mensuales) || 0,
          sueldos: parseFloat(costosData.sueldos_mensuales) || 0,
          otros: parseFloat(costosData.otros_gastos_mensuales) || 0,
          total: total
        })
        setCostosFijosConfigurados(total > 0)
      } else {
        setCostosFijosConfigurados(false)
      }
    } catch (error) {
      console.error('Error cargando costos fijos:', error)
      setCostosFijosConfigurados(false)
    }
  }

  async function cargarAnalisisPuntoEquilibrio() {
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
        precios_venta: number[]
        costos_variables: number[]
      }>()

      ventasData?.forEach((detalle: any) => {
        const productoId = detalle.producto_id
        const existing = productosMap.get(productoId) || {
          cantidad_vendida: 0,
          total_vendido: 0,
          precios_venta: [],
          costos_variables: []
        }

        existing.cantidad_vendida += detalle.cantidad
        existing.total_vendido += parseFloat(detalle.subtotal)
        existing.precios_venta.push(parseFloat(detalle.precio_unitario))
        existing.costos_variables.push(parseFloat(detalle.costo_unitario || 0))

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
        .select('id, codigo, nombre')
        .in('id', productosIds)

      if (errorProductos) throw errorProductos

      // Calcular análisis por producto
      const productosAnalisis: ProductoAnalisis[] = productosInfo?.map((p: any) => {
        const stats = productosMap.get(p.id)!
        
        const precioVentaPromedio = stats.precios_venta.reduce((a, b) => a + b, 0) / stats.precios_venta.length
        const costoVariablePromedio = stats.costos_variables.reduce((a, b) => a + b, 0) / stats.costos_variables.length
        const margenContribucionUnitario = precioVentaPromedio - costoVariablePromedio
        const razonContribucion = precioVentaPromedio > 0 ? (margenContribucionUnitario / precioVentaPromedio) * 100 : 0
        const contribucionTotal = stats.total_vendido - (stats.cantidad_vendida * costoVariablePromedio)

        // Punto de equilibrio individual del producto
        const puntoEquilibrioUnidadesProducto = margenContribucionUnitario > 0 
          ? Math.ceil(costosFijos.total / margenContribucionUnitario)
          : 0
        
        const puntoEquilibrioVentasProducto = puntoEquilibrioUnidadesProducto * precioVentaPromedio

        return {
          producto_id: p.id,
          codigo: p.codigo,
          nombre: p.nombre,
          cantidad_vendida: stats.cantidad_vendida,
          precio_venta_promedio: precioVentaPromedio,
          costo_variable_promedio: costoVariablePromedio,
          margen_contribucion_unitario: margenContribucionUnitario,
          razon_contribucion: razonContribucion,
          total_vendido: stats.total_vendido,
          punto_equilibrio_unidades: puntoEquilibrioUnidadesProducto,
          punto_equilibrio_ventas: puntoEquilibrioVentasProducto,
          contribucion_total: contribucionTotal
        }
      }) || []

      // Ordenar por contribución total
      productosAnalisis.sort((a, b) => b.contribucion_total - a.contribucion_total)

      // CÁLCULO GLOBAL DE PUNTO DE EQUILIBRIO (Mix de productos)
      const totalVendido = productosAnalisis.reduce((sum, p) => sum + p.total_vendido, 0)
      const totalCostoVariable = productosAnalisis.reduce((sum, p) => sum + (p.cantidad_vendida * p.costo_variable_promedio), 0)
      const margenContribucionTotal = totalVendido - totalCostoVariable
      const razonContribucionPromedioPonderada = totalVendido > 0 ? (margenContribucionTotal / totalVendido) : 0

      // Punto de equilibrio en ventas (Bs.)
      const puntoEquilibrioVentasGlobal = razonContribucionPromedioPonderada > 0 
        ? costosFijos.total / razonContribucionPromedioPonderada
        : 0

      // Calcular unidades aproximadas necesarias (basado en precio promedio ponderado)
      const totalUnidades = productosAnalisis.reduce((sum, p) => sum + p.cantidad_vendida, 0)
      const precioPromedioPonderado = totalUnidades > 0 ? totalVendido / totalUnidades : 0
      const puntoEquilibrioUnidadesGlobal = precioPromedioPonderado > 0 
        ? Math.ceil(puntoEquilibrioVentasGlobal / precioPromedioPonderado)
        : 0

      setPuntoEquilibrioUnidades(puntoEquilibrioUnidadesGlobal)
      setPuntoEquilibrioVentas(puntoEquilibrioVentasGlobal)

      // Margen de seguridad
      const margenSeg = totalVendido - puntoEquilibrioVentasGlobal
      const margenSegPorc = totalVendido > 0 ? (margenSeg / totalVendido) * 100 : 0
      setMargenSeguridad(margenSeg)
      setMargenSeguridadPorcentaje(margenSegPorc)

      // Días para alcanzar punto de equilibrio (basado en ritmo actual)
      const fechaInicio = new Date(fechaDesde)
      const fechaFin = new Date(fechaHasta)
      const diasTranscurridos = Math.max(1, Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)))
      const ventasDiarias = totalVendido / diasTranscurridos
      const diasNecesarios = ventasDiarias > 0 ? Math.ceil(puntoEquilibrioVentasGlobal / ventasDiarias) : 0
      setDiasParaEquilibrio(diasNecesarios)

      // Generar datos para la gráfica (Costos vs Ingresos)
      const maxUnidades = Math.max(puntoEquilibrioUnidadesGlobal * 2, totalUnidades)
      const datosGraf: DatoGrafica[] = []
      const costoVariableUnitario = totalUnidades > 0 ? totalCostoVariable / totalUnidades : 0

      for (let unidades = 0; unidades <= maxUnidades; unidades += Math.ceil(maxUnidades / 50)) {
        const costosVariables = unidades * costoVariableUnitario
        const costosTotales = costosFijos.total + costosVariables
        const ingresos = unidades * precioPromedioPonderado

        datosGraf.push({
          unidades,
          costos_fijos: costosFijos.total,
          costos_variables: costosVariables,
          costos_totales: costosTotales,
          ingresos: ingresos
        })
      }

      setDatosGrafica(datosGraf)
      setProductos(productosAnalisis)
    } catch (error) {
      console.error('Error cargando punto equilibrio:', error)
    } finally {
      setLoading(false)
    }
  }

  function exportarExcel() {
    // Hoja 1: Resumen general
    const resumenGeneral = [{
      'RESUMEN DEL ANÁLISIS': '',
      '': '',
    }, {
      'Concepto': 'Costos Fijos Mensuales',
      'Valor': costosFijos.total,
    }, {
      'Concepto': 'Punto de Equilibrio (unidades)',
      'Valor': puntoEquilibrioUnidades,
    }, {
      'Concepto': 'Punto de Equilibrio (Bs.)',
      'Valor': puntoEquilibrioVentas,
    }, {
      'Concepto': 'Margen de Seguridad (Bs.)',
      'Valor': margenSeguridad,
    }, {
      'Concepto': 'Margen de Seguridad %',
      'Valor': margenSeguridadPorcentaje,
    }, {
      'Concepto': 'Días para Alcanzar Equilibrio',
      'Valor': diasParaEquilibrio,
    }]

    // Hoja 2: Detalle por producto
    const datosProductos = productos.map((p, index) => ({
      'Posición': index + 1,
      'Código': p.codigo,
      'Producto': p.nombre,
      'Cantidad Vendida': p.cantidad_vendida,
      'Precio Venta Prom. (Bs.)': p.precio_venta_promedio,
      'Costo Variable Prom. (Bs.)': p.costo_variable_promedio,
      'MC Unitario (Bs.)': p.margen_contribucion_unitario,
      'Razón Contribución %': p.razon_contribucion,
      'Total Vendido (Bs.)': p.total_vendido,
      'Contribución Total (Bs.)': p.contribucion_total,
      'PE Individual (unidades)': p.punto_equilibrio_unidades,
      'PE Individual (Bs.)': p.punto_equilibrio_ventas
    }))

    const datosLimpios = prepararDatosParaExcel(datosProductos)

    exportarAExcel(
      datosLimpios,
      'Punto de Equilibrio',
      `punto-equilibrio-${fechaDesde}-${fechaHasta}`
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

  // Si no hay costos configurados, mostrar mensaje
  if (!costosFijosConfigurados) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 lg:pb-8">
        {/* Header */}
        <div className="bg-white border-b">
          <div className="px-4 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/dashboard/reportes')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">⚖️ Punto de Equilibrio</h1>
                <p className="text-sm text-gray-600">Análisis de rentabilidad y break-even</p>
              </div>
            </div>
          </div>
        </div>

        {/* Mensaje de configuración requerida */}
        <div className="p-4 max-w-2xl mx-auto mt-8">
          <div className="bg-amber-50 border-2 border-amber-500 rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Settings className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold text-amber-900 mb-2">
              Configura tus Costos Fijos
            </h2>
            <p className="text-amber-800 mb-6">
              Para calcular tu punto de equilibrio, primero necesitas configurar los <strong>costos fijos mensuales</strong> de tu negocio (alquiler, servicios, sueldos, etc.)
            </p>
            <button
              onClick={() => router.push('/dashboard/configuracion')}
              className="px-6 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors font-semibold inline-flex items-center gap-2"
            >
              <Settings className="w-5 h-5" />
              Ir a Configuración
            </button>
          </div>

          {/* Info de ayuda */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">💡 ¿Qué son los Costos Fijos?</h3>
            <p className="text-sm text-blue-800 mb-2">
              Son los gastos que pagas <strong>todos los meses</strong>, sin importar cuánto vendas:
            </p>
            <ul className="text-sm text-blue-800 space-y-1 ml-4">
              <li>• <strong>Alquiler</strong> del local</li>
              <li>• <strong>Servicios</strong> (luz, agua, internet, teléfono)</li>
              <li>• <strong>Sueldos</strong> del personal</li>
              <li>• <strong>Otros gastos</strong> fijos (seguridad, limpieza, etc.)</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  const totalVendido = productos.reduce((sum, p) => sum + p.total_vendido, 0)
  const alcanzoPuntoEquilibrio = totalVendido >= puntoEquilibrioVentas

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
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">⚖️ Punto de Equilibrio</h1>
              <p className="text-sm text-gray-600">Análisis de rentabilidad y break-even</p>
            </div>
            <button
              onClick={() => router.push('/dashboard/configuracion')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg 
                       hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Editar Costos</span>
            </button>
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
            {/* Alert de estado */}
            {alcanzoPuntoEquilibrio ? (
              <div className="bg-emerald-50 border-2 border-emerald-500 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-bold text-emerald-900 text-lg mb-1">
                      ¡Felicitaciones! Ya alcanzaste el punto de equilibrio 🎉
                    </h3>
                    <p className="text-emerald-800 text-sm">
                      Tus ventas de <strong>{formatearMoneda(totalVendido)}</strong> superaron 
                      el punto de equilibrio de <strong>{formatearMoneda(puntoEquilibrioVentas)}</strong>. 
                      Todo lo que vendas ahora es <strong>ganancia pura</strong> después de cubrir costos fijos.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border-2 border-amber-500 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-bold text-amber-900 text-lg mb-1">
                      Aún no alcanzas el punto de equilibrio
                    </h3>
                    <p className="text-amber-800 text-sm">
                      Te faltan <strong>{formatearMoneda(puntoEquilibrioVentas - totalVendido)}</strong> en ventas 
                      para cubrir tus costos fijos. Con el ritmo actual, lo alcanzarás en aproximadamente 
                      <strong> {diasParaEquilibrio} días</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Cards de métricas principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="bg-white p-5 rounded-xl border-2 border-blue-200">
                <p className="text-sm text-gray-600 mb-1">Costos Fijos Mensuales</p>
                <p className="text-3xl font-bold text-blue-600">{formatearMoneda(costosFijos.total)}</p>
                <p className="text-xs text-gray-500 mt-1">A cubrir cada mes</p>
              </div>

              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 rounded-xl text-white shadow-lg">
                <p className="text-sm opacity-90 mb-1">Punto de Equilibrio</p>
                <p className="text-3xl font-bold">{formatearMoneda(puntoEquilibrioVentas)}</p>
                <p className="text-xs opacity-75 mt-1">{puntoEquilibrioUnidades} unidades aprox.</p>
              </div>

              <div className="bg-white p-5 rounded-xl border-2 border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Ventas Actuales</p>
                <p className="text-3xl font-bold text-gray-900">{formatearMoneda(totalVendido)}</p>
                <p className="text-xs text-gray-500 mt-1">En el período</p>
              </div>

              <div className={`p-5 rounded-xl border-2 ${
                alcanzoPuntoEquilibrio 
                  ? 'bg-emerald-50 border-emerald-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <p className="text-sm text-gray-600 mb-1">Margen de Seguridad</p>
                <p className={`text-3xl font-bold ${alcanzoPuntoEquilibrio ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatearPorcentaje(margenSeguridadPorcentaje)}
                </p>
                <p className="text-xs text-gray-500 mt-1">{formatearMoneda(Math.abs(margenSeguridad))}</p>
              </div>
            </div>

            {/* Desglose de costos fijos */}
            <div className="bg-white rounded-xl p-6 mb-4">
              <h3 className="font-semibold text-gray-900 mb-4">💼 Desglose de Costos Fijos</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600">Alquiler</p>
                  <p className="text-lg font-bold text-gray-900">{formatearMoneda(costosFijos.alquiler)}</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600">Servicios</p>
                  <p className="text-lg font-bold text-gray-900">{formatearMoneda(costosFijos.servicios)}</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600">Sueldos</p>
                  <p className="text-lg font-bold text-gray-900">{formatearMoneda(costosFijos.sueldos)}</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600">Otros</p>
                  <p className="text-lg font-bold text-gray-900">{formatearMoneda(costosFijos.otros)}</p>
                </div>
                <div className="text-center p-3 bg-blue-100 rounded-lg border-2 border-blue-300">
                  <p className="text-xs text-blue-700 font-semibold">TOTAL</p>
                  <p className="text-lg font-bold text-blue-600">{formatearMoneda(costosFijos.total)}</p>
                </div>
              </div>
            </div>

            {/* GRÁFICA ESTRELLA: Punto de Equilibrio */}
            <div className="bg-white rounded-xl p-6 mb-4 shadow-lg border-2 border-emerald-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-gray-900 text-lg">
                    📊 Gráfica de Punto de Equilibrio
                  </h2>
                  <p className="text-sm text-gray-600">Donde se cruzan las líneas es tu punto de equilibrio</p>
                </div>
                <button
                  onClick={exportarExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg 
                           hover:bg-emerald-700 transition-colors text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Exportar Excel</span>
                </button>
              </div>

              <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={datosGrafica}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="unidades" 
                      label={{ value: 'Unidades Vendidas', position: 'insideBottom', offset: -5 }}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      label={{ value: 'Bs.', angle: -90, position: 'insideLeft' }}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      formatter={(value: any) => formatearMoneda(value)}
                      labelFormatter={(label) => `${label} unidades`}
                    />
                    <Legend />
                    
                    {/* Área de pérdida (roja) */}
                    <Area 
                      type="monotone" 
                      dataKey="costos_totales" 
                      fill="#FEE2E2" 
                      fillOpacity={0.3}
                      stroke="none"
                    />
                    
                    {/* Línea de costos fijos */}
                    <Line 
                      type="monotone" 
                      dataKey="costos_fijos" 
                      stroke="#9CA3AF" 
                      strokeWidth={2}
                      name="Costos Fijos"
                      strokeDasharray="5 5"
                      dot={false}
                    />
                    
                    {/* Línea de costos totales */}
                    <Line 
                      type="monotone" 
                      dataKey="costos_totales" 
                      stroke={COLORES_GRAFICAS.peligro}
                      strokeWidth={3}
                      name="Costos Totales"
                      dot={false}
                    />
                    
                    {/* Línea de ingresos */}
                    <Line 
                      type="monotone" 
                      dataKey="ingresos" 
                      stroke={COLORES_GRAFICAS.principal}
                      strokeWidth={3}
                      name="Ingresos"
                      dot={false}
                    />
                    
                    {/* Línea vertical en punto de equilibrio */}
                    <ReferenceLine 
                      x={puntoEquilibrioUnidades} 
                      stroke="#F59E0B" 
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      label={{ 
                        value: `Punto de Equilibrio: ${puntoEquilibrioUnidades} un.`, 
                        position: 'top',
                        fill: '#F59E0B',
                        fontSize: 12,
                        fontWeight: 'bold'
                      }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Leyenda explicativa */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <div className="w-4 h-4 bg-gray-400 rounded"></div>
                  <span className="text-gray-700"><strong>Costos Fijos:</strong> Siempre iguales (alquiler, sueldos)</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-red-50 rounded">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span className="text-gray-700"><strong>Costos Totales:</strong> Fijos + Variables</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded">
                  <div className="w-4 h-4 bg-emerald-500 rounded"></div>
                  <span className="text-gray-700"><strong>Ingresos:</strong> Ventas totales</span>
                </div>
              </div>
            </div>

            {/* Análisis por producto */}
            <div className="bg-white rounded-xl overflow-hidden mb-4">
              <div className="px-6 py-4 border-b bg-gray-50">
                <h2 className="font-semibold text-gray-900">
                  🎯 Contribución por Producto al Punto de Equilibrio
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Productos ordenados por su aporte a cubrir costos fijos
                </p>
              </div>
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
                        MC Unitario
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                        Razón %
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                        Contribución
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">
                        PE Individual
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {productos.map((producto, index) => (
                      <tr key={producto.producto_id} className="hover:bg-gray-50">
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs">
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
                        <td className="px-3 py-3 text-right text-blue-600 font-medium hidden md:table-cell">
                          {formatearMoneda(producto.margen_contribucion_unitario)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                            producto.razon_contribucion >= 50
                              ? 'bg-emerald-100 text-emerald-700'
                              : producto.razon_contribucion >= 30
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {formatearPorcentaje(producto.razon_contribucion)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-emerald-600">
                          {formatearMoneda(producto.contribucion_total)}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-600 hidden lg:table-cell">
                          {producto.punto_equilibrio_unidades} un.
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Guía de interpretación */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
              <div className="flex items-start gap-3 mb-4">
                <Info className="w-6 h-6 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-blue-900 text-lg mb-2">
                    📚 Guía para Entender tu Punto de Equilibrio
                  </h3>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-white p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">🎯 ¿Qué es el Punto de Equilibrio?</h4>
                  <p className="text-gray-700">
                    Es el nivel de ventas donde <strong>no ganas ni pierdes</strong>. Tus ingresos cubren exactamente 
                    todos tus costos (fijos + variables). Todo lo que vendas por encima es <strong>ganancia pura</strong>.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">💡 ¿Cómo se calcula?</h4>
                  <p className="text-gray-700 mb-2">
                    <strong>PE en Bs. = Costos Fijos ÷ Razón de Contribución</strong>
                  </p>
                  <p className="text-gray-600 text-xs">
                    La razón de contribución es el % de cada venta que queda para cubrir costos fijos.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">📊 ¿Cómo leer la gráfica?</h4>
                  <ul className="text-gray-700 space-y-1 text-xs">
                    <li>• <strong>Izquierda del punto:</strong> Estás perdiendo dinero 🔴</li>
                    <li>• <strong>En el punto:</strong> Cubres costos, sin ganancia 🟡</li>
                    <li>• <strong>Derecha del punto:</strong> Estás ganando dinero 🟢</li>
                    <li>• <strong>Más lejos del punto:</strong> Más ganancia tienes ✨</li>
                  </ul>
                </div>

                <div className="bg-white p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">🎯 ¿Cómo mejorarlo?</h4>
                  <ul className="text-gray-700 space-y-1 text-xs">
                    <li>• <strong>Reducir costos fijos:</strong> Negociar alquiler, optimizar personal</li>
                    <li>• <strong>Aumentar margen:</strong> Subir precios o reducir costos variables</li>
                    <li>• <strong>Vender más:</strong> Aumentar volumen de ventas</li>
                    <li>• <strong>Mix de productos:</strong> Priorizar productos con mayor razón de contribución</li>
                  </ul>
                </div>
              </div>

              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-900">
                  <strong>💡 Tip Pro:</strong> Un margen de seguridad del 20-30% es saludable. 
                  Significa que puedes tener una caída de ventas de ese % y aún así cubrir costos.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}