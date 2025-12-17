'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { formatCurrency } from '@/lib/utils/format'
import { formatDateTime } from '@/lib/utils/timezone'
import Link from 'next/link'

interface SucursalStats {
  id: string
  nombre: string
  activa: boolean
  ventasHoy: number
  cantidadVentasHoy: number
  productosActivos: number
  productosSinStock: number
  cajasAbiertas: number
}

interface GlobalStats {
  totalEmpresas: number
  empresasActivas: number
  totalSucursales: number
  sucursalesActivas: number
  totalUsuarios: number
  usuariosActivos: number
  totalProductos: number
  ventasHoyGlobal: number
  cantidadVentasHoy: number
}

interface ActividadReciente {
  tipo: 'venta' | 'usuario' | 'producto' | 'traspaso'
  descripcion: string
  sucursal: string
  fecha: string
}

export default function AdminDashboard() {
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    totalEmpresas: 0,
    empresasActivas: 0,
    totalSucursales: 0,
    sucursalesActivas: 0,
    totalUsuarios: 0,
    usuariosActivos: 0,
    totalProductos: 0,
    ventasHoyGlobal: 0,
    cantidadVentasHoy: 0
  })
  const [sucursalesStats, setSucursalesStats] = useState<SucursalStats[]>([])
  const [actividades, setActividades] = useState<ActividadReciente[]>([])
  const [loading, setLoading] = useState(true)

  const { usuario } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (usuario?.empresa_id) {
      loadDashboardData()
    }
  }, [usuario?.empresa_id])

  const loadDashboardData = async () => {
    if (!usuario?.empresa_id) return

    setLoading(true)
    try {
      // Fecha de hoy
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const hoyISO = hoy.toISOString()

      // 1. Estadísticas globales
      const [empresasRes, sucursalesRes, usuariosRes] = await Promise.all([
        supabase.from('empresas').select('id, activa'),
        supabase.from('sucursales').select('id, activa, empresa_id, nombre'),
        supabase.from('usuarios').select('id, activo, empresa_id')
      ])

      // Filtrar por empresa del usuario (si no es super admin)
      const misEmpresas = empresasRes.data || []
      const misSucursales = sucursalesRes.data?.filter(s => 
        usuario.rol === 'admin' ? s.empresa_id === usuario.empresa_id : true
      ) || []
      const misUsuarios = usuariosRes.data?.filter(u => 
        usuario.rol === 'admin' ? u.empresa_id === usuario.empresa_id : true
      ) || []

      // 2. Productos totales
      const sucursalIds = misSucursales.map(s => s.id)
      const { data: productosData } = await supabase
        .from('productos')
        .select('id, sucursal_id, stock_actual, activo')
        .in('sucursal_id', sucursalIds)

      // 3. Ventas de hoy
      const { data: ventasHoy } = await supabase
        .from('ventas')
        .select('id, sucursal_id, total')
        .in('sucursal_id', sucursalIds)
        .eq('estado', 'completada')
        .gte('created_at', hoyISO)

      // 4. Cajas abiertas por sucursal
      const { data: cajasAbiertas } = await supabase
        .from('cajas')
        .select('id, sucursal_id')
        .in('sucursal_id', sucursalIds)
        .eq('estado', 'abierta')

      // Calcular estadísticas por sucursal
      const sucursalesConStats: SucursalStats[] = misSucursales.map(suc => {
        const ventasSuc = ventasHoy?.filter(v => v.sucursal_id === suc.id) || []
        const productosSuc = productosData?.filter(p => p.sucursal_id === suc.id && p.activo) || []
        const cajasSuc = cajasAbiertas?.filter(c => c.sucursal_id === suc.id) || []

        return {
          id: suc.id,
          nombre: suc.nombre,
          activa: suc.activa,
          ventasHoy: ventasSuc.reduce((sum, v) => sum + v.total, 0),
          cantidadVentasHoy: ventasSuc.length,
          productosActivos: productosSuc.length,
          productosSinStock: productosSuc.filter(p => p.stock_actual <= 0).length,
          cajasAbiertas: cajasSuc.length
        }
      })

      setSucursalesStats(sucursalesConStats.sort((a, b) => b.ventasHoy - a.ventasHoy))

      // Estadísticas globales
      setGlobalStats({
        totalEmpresas: misEmpresas.length,
        empresasActivas: misEmpresas.filter(e => e.activa).length,
        totalSucursales: misSucursales.length,
        sucursalesActivas: misSucursales.filter(s => s.activa).length,
        totalUsuarios: misUsuarios.length,
        usuariosActivos: misUsuarios.filter(u => u.activo).length,
        totalProductos: productosData?.filter(p => p.activo).length || 0,
        ventasHoyGlobal: ventasHoy?.reduce((sum, v) => sum + v.total, 0) || 0,
        cantidadVentasHoy: ventasHoy?.length || 0
      })

      // 5. Actividad reciente (últimas ventas)
      const { data: ultimasVentas } = await supabase
        .from('ventas')
        .select(`
          id, numero_venta, total, created_at,
          sucursal:sucursales(nombre)
        `)
        .in('sucursal_id', sucursalIds)
        .eq('estado', 'completada')
        .order('created_at', { ascending: false })
        .limit(5)

      const actividadesRecientes: ActividadReciente[] = ultimasVentas?.map(v => ({
        tipo: 'venta' as const,
        descripcion: `Venta #${v.numero_venta} por ${formatCurrency(v.total)}`,
        sucursal: (v.sucursal as any)?.nombre || 'Desconocida',
        fecha: v.created_at
      })) || []

      setActividades(actividadesRecientes)

    } catch (err) {
      console.error('Error cargando dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Panel de Administración</h1>
        <p className="text-gray-600 mt-1">Resumen general del sistema</p>
      </div>

      {/* Stats principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Ventas Hoy */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm">Ventas Hoy</p>
              <p className="text-3xl font-bold">{formatCurrency(globalStats.ventasHoyGlobal)}</p>
              <p className="text-emerald-200 text-xs mt-1">{globalStats.cantidadVentasHoy} ventas</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Sucursales */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Sucursales</p>
              <p className="text-3xl font-bold text-gray-900">{globalStats.sucursalesActivas}</p>
              <p className="text-xs text-gray-500 mt-1">{globalStats.totalSucursales} total</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Usuarios */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Usuarios</p>
              <p className="text-3xl font-bold text-gray-900">{globalStats.usuariosActivos}</p>
              <p className="text-xs text-gray-500 mt-1">{globalStats.totalUsuarios} total</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Productos */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Productos</p>
              <p className="text-3xl font-bold text-gray-900">{globalStats.totalProductos}</p>
              <p className="text-xs text-gray-500 mt-1">En todas las sucursales</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Sucursales */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Sucursales - Ventas de Hoy</h2>
            <Link href="/admin/sucursales" className="text-sm text-emerald-600 font-medium hover:underline">
              Ver todas
            </Link>
          </div>

          {sucursalesStats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No hay sucursales configuradas</p>
              <Link href="/admin/sucursales" className="text-emerald-600 font-medium mt-2 inline-block">
                Crear sucursal →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {sucursalesStats.map((suc, index) => (
                <div 
                  key={suc.id}
                  className={`p-4 rounded-xl border ${
                    suc.activa ? 'bg-gray-50 border-gray-100' : 'bg-gray-100 border-gray-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold ${
                        index === 0 ? 'bg-yellow-500' :
                        index === 1 ? 'bg-gray-400' :
                        index === 2 ? 'bg-amber-600' :
                        'bg-gray-300'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{suc.nombre}</p>
                          {!suc.activa && (
                            <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded-full">Inactiva</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                          <span>{suc.cantidadVentasHoy} ventas</span>
                          <span>•</span>
                          <span>{suc.productosActivos} productos</span>
                          {suc.cajasAbiertas > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-green-600">{suc.cajasAbiertas} caja{suc.cajasAbiertas > 1 ? 's' : ''} abierta{suc.cajasAbiertas > 1 ? 's' : ''}</span>
                            </>
                          )}
                          {suc.productosSinStock > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-red-600">{suc.productosSinStock} sin stock</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-emerald-600">{formatCurrency(suc.ventasHoy)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actividad y accesos rápidos */}
        <div className="space-y-6">
          {/* Accesos rápidos */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Gestión Rápida</h2>
            <div className="grid grid-cols-2 gap-3">
              <Link 
                href="/admin/empresas"
                className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-center"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700">Empresas</span>
              </Link>

              <Link 
                href="/admin/sucursales"
                className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-center"
              >
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700">Sucursales</span>
              </Link>

              <Link 
                href="/admin/usuarios"
                className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-center"
              >
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700">Usuarios</span>
              </Link>

              <Link 
                href="/admin/reportes"
                className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-center"
              >
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700">Reportes</span>
              </Link>
            </div>
          </div>

          {/* Actividad reciente */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Actividad Reciente</h2>
            
            {actividades.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                No hay actividad reciente
              </div>
            ) : (
              <div className="space-y-3">
                {actividades.map((act, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      act.tipo === 'venta' ? 'bg-green-500' :
                      act.tipo === 'usuario' ? 'bg-blue-500' :
                      act.tipo === 'producto' ? 'bg-yellow-500' :
                      'bg-purple-500'
                    }`}></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{act.descripcion}</p>
                      <p className="text-xs text-gray-500">{act.sucursal}</p>
                    </div>
                    <p className="text-xs text-gray-400 whitespace-nowrap">
                      {formatDateTime(act.fecha).split(' ')[1]}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}