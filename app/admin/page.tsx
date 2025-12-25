// Path: app\admin\page.tsx
'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { formatCurrency, formatNumber } from '@/lib/utils/format'
import { formatDateTime } from '@/lib/utils/timezone'
import SucursalCard from '@/components/admin/sucursal-card'

interface Empresa {
  id: string
  nombre: string
  activa: boolean
}

interface Sucursal {
  id: string
  nombre: string
  direccion: string | null
  activa: boolean
  empresa: {
    nombre: string
  }
}

interface SucursalMetrics {
  ventasHoy: number
  productosStockBajo: number
  productosSinStock: number
  usuariosActivos: number
  creditosPendientes: number
  cajaAbierta: boolean
}

interface AlertaCritica {
  id: string
  tipo: 'sin_stock' | 'stock_bajo' | 'credito_vencido' | 'caja_cerrada'
  sucursal: string
  mensaje: string
  urgencia: 'alta' | 'media' | 'baja'
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const supabase = createClient()

  // Estados
  const [loading, setLoading] = useState(true)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [metrics, setMetrics] = useState<Record<string, SucursalMetrics>>({})
  const [alertas, setAlertas] = useState<AlertaCritica[]>([])
  const [selectedEmpresa, setSelectedEmpresa] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Métricas globales calculadas
  const metricsGlobales = useMemo(() => {
    const totalSucursales = sucursales.length
    const sucursalesActivas = sucursales.filter(s => s.activa).length
    const totalVentasHoy = Object.values(metrics).reduce((sum, m) => sum + m.ventasHoy, 0)
    const totalProductosSinStock = Object.values(metrics).reduce((sum, m) => sum + m.productosSinStock, 0)
    const totalProductosStockBajo = Object.values(metrics).reduce((sum, m) => sum + m.productosStockBajo, 0)
    const totalUsuarios = Object.values(metrics).reduce((sum, m) => sum + m.usuariosActivos, 0)
    const totalCreditosPendientes = Object.values(metrics).reduce((sum, m) => sum + m.creditosPendientes, 0)

    return {
      totalSucursales,
      sucursalesActivas,
      totalVentasHoy,
      totalProductosSinStock,
      totalProductosStockBajo,
      totalUsuarios,
      totalCreditosPendientes
    }
  }, [sucursales, metrics])

  // Cargar datos iniciales
  useEffect(() => {
    cargarDatos()
  }, [refreshTrigger])

  const cargarDatos = async () => {
    try {
      // Cargar empresas
      const { data: empresasData } = await supabase
        .from('empresas')
        .select('id, nombre, activa')
        .order('nombre')

      if (empresasData) {
        setEmpresas(empresasData)
        
        // Si no hay empresa seleccionada, seleccionar la primera
        if (!selectedEmpresa && empresasData.length > 0) {
          setSelectedEmpresa(empresasData[0].id)
        }
      }

      // Cargar sucursales
      const { data: sucursalesData } = await supabase
        .from('sucursales')
        .select(`
          id,
          nombre,
          direccion,
          activa,
          empresas (
            nombre
          )
        `)
        .order('nombre')

      if (sucursalesData) {
        const sucursalesFormatted = sucursalesData.map(s => ({
          id: s.id,
          nombre: s.nombre,
          direccion: s.direccion,
          activa: s.activa,
          empresa: {
            nombre: (s.empresas as any).nombre
          }
        }))
        setSucursales(sucursalesFormatted)

        // Cargar métricas para cada sucursal
        await cargarMetricas(sucursalesFormatted)
      }

      // Cargar alertas críticas
      await cargarAlertas()

    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const cargarMetricas = async (sucursalesList: Sucursal[]) => {
    const hoy = new Date().toISOString().split('T')[0]
    const metricsTemp: Record<string, SucursalMetrics> = {}

    for (const sucursal of sucursalesList) {
      try {
        // Ventas del día
        const { data: ventasData } = await supabase
          .from('ventas')
          .select('total')
          .eq('sucursal_id', sucursal.id)
          .gte('created_at', hoy)
          .eq('estado', 'completada')

        const ventasHoy = ventasData?.reduce((sum, v) => sum + Number(v.total), 0) || 0

        // Productos sin stock
        const { count: sinStock } = await supabase
          .from('productos')
          .select('*', { count: 'exact', head: true })
          .eq('sucursal_id', sucursal.id)
          .eq('stock_actual', 0)
          .eq('activo', true)

        // Productos con stock bajo
        const { data: productosData } = await supabase
          .from('productos')
          .select('stock_actual, stock_minimo')
          .eq('sucursal_id', sucursal.id)
          .eq('activo', true)

        const stockBajo = productosData?.filter(p => 
          p.stock_actual > 0 && p.stock_actual <= p.stock_minimo
        ).length || 0

        // Usuarios activos
        const { count: usuariosActivos } = await supabase
          .from('usuarios')
          .select('*', { count: 'exact', head: true })
          .eq('sucursal_id', sucursal.id)
          .eq('activo', true)

        // Créditos pendientes
        const { count: creditosPendientes } = await supabase
          .from('creditos')
          .select('*', { count: 'exact', head: true })
          .eq('sucursal_id', sucursal.id)
          .in('estado', ['pendiente', 'vencido'])

        // Caja abierta
        const { data: cajaData } = await supabase
          .from('cajas')
          .select('estado')
          .eq('sucursal_id', sucursal.id)
          .eq('estado', 'abierta')
          .maybeSingle()

        metricsTemp[sucursal.id] = {
          ventasHoy,
          productosStockBajo: stockBajo,
          productosSinStock: sinStock || 0,
          usuariosActivos: usuariosActivos || 0,
          creditosPendientes: creditosPendientes || 0,
          cajaAbierta: !!cajaData
        }
      } catch (error) {
        console.error(`Error cargando métricas para ${sucursal.nombre}:`, error)
        metricsTemp[sucursal.id] = {
          ventasHoy: 0,
          productosStockBajo: 0,
          productosSinStock: 0,
          usuariosActivos: 0,
          creditosPendientes: 0,
          cajaAbierta: false
        }
      }
    }

    setMetrics(metricsTemp)
  }

  const cargarAlertas = async () => {
    const alertasTemp: AlertaCritica[] = []

    // Obtener todas las sucursales
    const { data: sucursalesData } = await supabase
      .from('sucursales')
      .select('id, nombre')

    if (!sucursalesData) return

    for (const sucursal of sucursalesData) {
      // Alertas de productos sin stock
      const { count: sinStock } = await supabase
        .from('productos')
        .select('*', { count: 'exact', head: true })
        .eq('sucursal_id', sucursal.id)
        .eq('stock_actual', 0)
        .eq('activo', true)

      if (sinStock && sinStock > 0) {
        alertasTemp.push({
          id: `${sucursal.id}-sin-stock`,
          tipo: 'sin_stock',
          sucursal: sucursal.nombre,
          mensaje: `${sinStock} producto${sinStock > 1 ? 's' : ''} sin stock`,
          urgencia: 'alta'
        })
      }

      // Alertas de créditos vencidos
      const { count: creditosVencidos } = await supabase
        .from('creditos')
        .select('*', { count: 'exact', head: true })
        .eq('sucursal_id', sucursal.id)
        .eq('estado', 'vencido')

      if (creditosVencidos && creditosVencidos > 0) {
        alertasTemp.push({
          id: `${sucursal.id}-creditos`,
          tipo: 'credito_vencido',
          sucursal: sucursal.nombre,
          mensaje: `${creditosVencidos} crédito${creditosVencidos > 1 ? 's' : ''} vencido${creditosVencidos > 1 ? 's' : ''}`,
          urgencia: 'media'
        })
      }
    }

    setAlertas(alertasTemp)
  }

  const handleToggleSucursal = async (id: string, nuevoEstado: boolean) => {
    try {
      const { error } = await supabase
        .from('sucursales')
        .update({ activa: nuevoEstado })
        .eq('id', id)

      if (error) throw error

      // Refrescar datos
      setRefreshTrigger(prev => prev + 1)
    } catch (error) {
      console.error('Error actualizando sucursal:', error)
      alert('Error al actualizar el estado de la sucursal')
    }
  }

  // Filtrar sucursales por empresa seleccionada
  const sucursalesFiltradas = selectedEmpresa
    ? sucursales.filter(s => {
        const empresaNombre = s.empresa.nombre
        const empresaSeleccionada = empresas.find(e => e.id === selectedEmpresa)
        return empresaSeleccionada && empresaNombre === empresaSeleccionada.nombre
      })
    : sucursales

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header con título y acciones */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Administrativo</h1>
          <p className="text-gray-600 text-sm mt-1">Panel de control y supervisión</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setRefreshTrigger(prev => prev + 1)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar
          </button>

          <a
            href="/admin/reportes"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            📊 Reportes
          </a>
        </div>
      </div>

      {/* Métricas globales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border-2 border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-blue-600 font-medium">💰 Ventas Hoy</span>
          </div>
          <p className="text-2xl font-bold text-blue-900">{formatCurrency(metricsGlobales.totalVentasHoy)}</p>
          <p className="text-xs text-blue-600 mt-1">Todas las sucursales</p>
        </div>

        <div className="bg-white rounded-xl p-4 border-2 border-green-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-green-600 font-medium">🏪 Sucursales</span>
          </div>
          <p className="text-2xl font-bold text-green-900">
            {metricsGlobales.sucursalesActivas}/{metricsGlobales.totalSucursales}
          </p>
          <p className="text-xs text-green-600 mt-1">Activas</p>
        </div>

        <div className="bg-white rounded-xl p-4 border-2 border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-purple-600 font-medium">👥 Usuarios</span>
          </div>
          <p className="text-2xl font-bold text-purple-900">{formatNumber(metricsGlobales.totalUsuarios)}</p>
          <p className="text-xs text-purple-600 mt-1">Activos</p>
        </div>

        <div className={`bg-white rounded-xl p-4 border-2 ${
          metricsGlobales.totalProductosSinStock > 0 ? 'border-red-200' : 'border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${
              metricsGlobales.totalProductosSinStock > 0 ? 'text-red-600' : 'text-gray-600'
            }`}>📦 Sin Stock</span>
          </div>
          <p className={`text-2xl font-bold ${
            metricsGlobales.totalProductosSinStock > 0 ? 'text-red-900' : 'text-gray-900'
          }`}>{metricsGlobales.totalProductosSinStock}</p>
          <p className={`text-xs mt-1 ${
            metricsGlobales.totalProductosSinStock > 0 ? 'text-red-600' : 'text-gray-600'
          }`}>Productos</p>
        </div>
      </div>

      {/* Alertas críticas */}
      {alertas.length > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="font-semibold text-red-900">Alertas Críticas ({alertas.length})</h3>
          </div>
          <div className="space-y-2">
            {alertas.slice(0, 5).map(alerta => (
              <div key={alerta.id} className="bg-white rounded-lg p-3 flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{alerta.sucursal}</p>
                  <p className="text-sm text-gray-600">{alerta.mensaje}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  alerta.urgencia === 'alta' ? 'bg-red-100 text-red-700' :
                  alerta.urgencia === 'media' ? 'bg-orange-100 text-orange-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {alerta.urgencia === 'alta' ? '🔴' : alerta.urgencia === 'media' ? '🟡' : '🟢'}
                </span>
              </div>
            ))}
          </div>
          {alertas.length > 5 && (
            <p className="text-sm text-red-600 text-center mt-2">
              +{alertas.length - 5} alertas más
            </p>
          )}
        </div>
      )}

      {/* Selector de empresa */}
      <div className="bg-white rounded-xl p-4 border-2 border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Filtrar por empresa:
        </label>
        <select
          value={selectedEmpresa || ''}
          onChange={(e) => setSelectedEmpresa(e.target.value || null)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          <option value="">Todas las empresas</option>
          {empresas.map(empresa => (
            <option key={empresa.id} value={empresa.id}>
              {empresa.nombre} {!empresa.activa && '(Inactiva)'}
            </option>
          ))}
        </select>
      </div>

      {/* Lista de sucursales */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Sucursales {selectedEmpresa && `(${sucursalesFiltradas.length})`}
        </h2>
        
        {sucursalesFiltradas.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-8 text-center">
            <p className="text-gray-600">No hay sucursales para mostrar</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {sucursalesFiltradas.map(sucursal => (
              <SucursalCard
                key={sucursal.id}
                sucursal={sucursal}
                metrics={metrics[sucursal.id] || {
                  ventasHoy: 0,
                  productosStockBajo: 0,
                  productosSinStock: 0,
                  usuariosActivos: 0,
                  creditosPendientes: 0,
                  cajaAbierta: false
                }}
                onToggleEstado={handleToggleSucursal}
              />
            ))}
          </div>
        )}
      </div>

      {/* Accesos rápidos */}
      <div className="bg-white rounded-xl p-4 border-2 border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4">Accesos Rápidos</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <a
            href="/admin/empresas"
            className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-center"
          >
            <div className="text-2xl mb-2">🏢</div>
            <p className="text-sm font-medium text-blue-900">Empresas</p>
          </a>
          <a
            href="/admin/sucursales"
            className="p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors text-center"
          >
            <div className="text-2xl mb-2">🏪</div>
            <p className="text-sm font-medium text-green-900">Sucursales</p>
          </a>
          <a
            href="/admin/usuarios"
            className="p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors text-center"
          >
            <div className="text-2xl mb-2">👥</div>
            <p className="text-sm font-medium text-purple-900">Usuarios</p>
          </a>
          <a
            href="/admin/reportes"
            className="p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors text-center"
          >
            <div className="text-2xl mb-2">📊</div>
            <p className="text-sm font-medium text-orange-900">Reportes</p>
          </a>
        </div>
      </div>
    </div>
  )
}
