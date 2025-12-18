'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/format'
import { getToday } from '@/lib/utils/timezone'

interface Empresa {
  id: string
  nombre: string
  activa: boolean
  sucursales: Sucursal[]
}

interface Sucursal {
  id: string
  nombre: string
  telefono: string | null
  activa: boolean
  empresa_id: string
  ventasHoy: number
  cantidadTickets: number
  totalProductos: number
  productosSinStock: number
  productosStockBajo: number
  creditosPendientes: number
  cajasAbiertas: number
  usuariosActivos: number
}

export default function AdminPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [empresaExpandida, setEmpresaExpandida] = useState<string | null>(null)
  const [sucursalModal, setSucursalModal] = useState<Sucursal & { empresaNombre: string } | null>(null)
  const [metricas, setMetricas] = useState({
    totalEmpresas: 0,
    totalSucursales: 0,
    ventasHoy: 0,
    empresasActivas: 0
  })

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const hoy = getToday()
      const inicioHoy = `${hoy}T00:00:00`
      const finHoy = `${hoy}T23:59:59`

      const { data: empresasData } = await supabase.from('empresas').select('*').order('nombre')
      const { data: sucursalesData } = await supabase.from('sucursales').select('*').order('nombre')
      const { data: ventasData } = await supabase.from('ventas').select('sucursal_id, total').eq('estado', 'completada').gte('created_at', inicioHoy).lte('created_at', finHoy)
      const { data: productosData } = await supabase.from('productos').select('sucursal_id, stock_actual, stock_minimo')
      const { data: creditosData } = await supabase.from('creditos').select('sucursal_id').eq('estado', 'pendiente')
      const { data: cajasData } = await supabase.from('cajas').select('sucursal_id').eq('estado', 'abierta')
      const { data: usuariosData } = await supabase.from('usuarios').select('sucursal_id').eq('activo', true)

      const sucursalesConMetricas: Sucursal[] = (sucursalesData || []).map(suc => {
        const ventasSuc = (ventasData || []).filter(v => v.sucursal_id === suc.id)
        const productosSuc = (productosData || []).filter(p => p.sucursal_id === suc.id)
        return {
          ...suc,
          ventasHoy: ventasSuc.reduce((sum, v) => sum + Number(v.total), 0),
          cantidadTickets: ventasSuc.length,
          totalProductos: productosSuc.length,
          productosSinStock: productosSuc.filter(p => p.stock_actual <= 0).length,
          productosStockBajo: productosSuc.filter(p => p.stock_actual > 0 && p.stock_actual <= (p.stock_minimo || 5)).length,
          creditosPendientes: (creditosData || []).filter(c => c.sucursal_id === suc.id).length,
          cajasAbiertas: (cajasData || []).filter(c => c.sucursal_id === suc.id).length,
          usuariosActivos: (usuariosData || []).filter(u => u.sucursal_id === suc.id).length
        }
      })

      const empresasConSucursales: Empresa[] = (empresasData || []).map(emp => ({
        ...emp,
        sucursales: sucursalesConMetricas.filter(s => s.empresa_id === emp.id)
      }))

      setEmpresas(empresasConSucursales)
      setMetricas({
        totalEmpresas: empresasData?.length || 0,
        totalSucursales: sucursalesData?.length || 0,
        ventasHoy: sucursalesConMetricas.reduce((sum, s) => sum + s.ventasHoy, 0),
        empresasActivas: empresasData?.filter(e => e.activa).length || 0
      })
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Panel Administrativo</h1>
        <p className="text-gray-500 text-sm">Vista general del sistema</p>
      </div>

      {/* Métricas Globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{metricas.totalEmpresas}</p>
              <p className="text-xs text-gray-500">Empresas</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{metricas.totalSucursales}</p>
              <p className="text-xs text-gray-500">Sucursales</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(metricas.ventasHoy)}</p>
              <p className="text-xs text-gray-500">Ventas Hoy</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{metricas.empresasActivas}</p>
              <p className="text-xs text-gray-500">Activas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        <a href="/admin/empresas" className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 text-center hover:border-emerald-300 transition-all">
          <svg className="w-6 h-6 mx-auto text-purple-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span className="text-xs font-medium text-gray-700">Empresas</span>
        </a>
        <a href="/admin/sucursales" className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 text-center hover:border-emerald-300 transition-all">
          <svg className="w-6 h-6 mx-auto text-blue-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
          <span className="text-xs font-medium text-gray-700">Sucursales</span>
        </a>
        <a href="/admin/usuarios" className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 text-center hover:border-emerald-300 transition-all">
          <svg className="w-6 h-6 mx-auto text-emerald-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span className="text-xs font-medium text-gray-700">Usuarios</span>
        </a>
        <a href="/admin/reportes" className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 text-center hover:border-emerald-300 transition-all">
          <svg className="w-6 h-6 mx-auto text-amber-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-xs font-medium text-gray-700">Reportes</span>
        </a>
      </div>

      {/* Lista de Empresas */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Empresas y Sucursales</h2>
        <p className="text-sm text-gray-500">Toca una empresa para ver sus sucursales</p>
      </div>

      <div className="space-y-3">
        {empresas.map((empresa) => (
          <div key={empresa.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <button
              onClick={() => setEmpresaExpandida(prev => prev === empresa.id ? null : empresa.id)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${empresa.activa ? 'bg-purple-100' : 'bg-gray-100'}`}>
                  <svg className={`w-5 h-5 ${empresa.activa ? 'text-purple-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900">{empresa.nombre}</h3>
                  <p className="text-sm text-gray-500">{empresa.sucursales.filter(s => s.activa).length} sucursales activas</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="font-semibold text-emerald-600">{formatCurrency(empresa.sucursales.reduce((s, suc) => s + suc.ventasHoy, 0))}</p>
                  <p className="text-xs text-gray-500">hoy</p>
                </div>
                <svg className={`w-5 h-5 text-gray-400 transition-transform ${empresaExpandida === empresa.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Panel expandido con sucursales */}
            {empresaExpandida === empresa.id && (
              <div className="border-t border-gray-100 p-4 bg-gray-50">
                {empresa.sucursales.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No hay sucursales</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {empresa.sucursales.map((sucursal) => (
                      <button
                        key={sucursal.id}
                        onClick={() => setSucursalModal({ ...sucursal, empresaNombre: empresa.nombre })}
                        className={`p-4 rounded-xl border text-left transition-all hover:shadow-md ${sucursal.activa ? 'bg-white border-gray-200' : 'bg-orange-50 border-orange-200'}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">{sucursal.nombre}</h4>
                            {sucursal.cajasAbiertas > 0 && (
                              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            )}
                          </div>
                          {!sucursal.activa && (
                            <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Pausada</span>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-lg font-bold text-emerald-600">{formatCurrency(sucursal.ventasHoy)}</p>
                            <p className="text-xs text-gray-500">Ventas</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-gray-900">{sucursal.cantidadTickets}</p>
                            <p className="text-xs text-gray-500">Tickets</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-gray-900">{sucursal.totalProductos}</p>
                            <p className="text-xs text-gray-500">Productos</p>
                          </div>
                        </div>

                        {/* Alertas */}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {sucursal.productosSinStock > 0 && (
                            <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">{sucursal.productosSinStock} sin stock</span>
                          )}
                          {sucursal.productosStockBajo > 0 && (
                            <span className="text-xs bg-amber-100 text-amber-600 px-2 py-1 rounded-full">{sucursal.productosStockBajo} stock bajo</span>
                          )}
                          {sucursal.creditosPendientes > 0 && (
                            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">{sucursal.creditosPendientes} créditos</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {empresas.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No hay empresas</h3>
          <p className="text-gray-500">Comienza creando tu primera empresa</p>
        </div>
      )}

      {/* Modal Detalle Sucursal */}
      {sucursalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSucursalModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{sucursalModal.nombre}</h3>
                  <p className="text-sm text-gray-500">{sucursalModal.empresaNombre}</p>
                </div>
                <button onClick={() => setSucursalModal(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-600">Estado</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${sucursalModal.activa ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                    {sucursalModal.activa ? 'Activa' : 'Pausada'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-600">Cajas abiertas</span>
                  <span className="font-medium text-gray-900 flex items-center gap-2">
                    {sucursalModal.cajasAbiertas}
                    {sucursalModal.cajasAbiertas > 0 && <span className="w-2 h-2 bg-green-500 rounded-full"></span>}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-600">Usuarios activos</span>
                  <span className="font-medium text-gray-900">{sucursalModal.usuariosActivos}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-600">Total productos</span>
                  <span className="font-medium text-gray-900">{sucursalModal.totalProductos}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-600">Sin stock</span>
                  <span className={`font-medium ${sucursalModal.productosSinStock > 0 ? 'text-red-600' : 'text-gray-900'}`}>{sucursalModal.productosSinStock}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-600">Stock bajo</span>
                  <span className={`font-medium ${sucursalModal.productosStockBajo > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{sucursalModal.productosStockBajo}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-600">Créditos pendientes</span>
                  <span className={`font-medium ${sucursalModal.creditosPendientes > 0 ? 'text-blue-600' : 'text-gray-900'}`}>{sucursalModal.creditosPendientes}</span>
                </div>

                {sucursalModal.telefono && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="text-gray-600">Teléfono</span>
                    <span className="font-medium text-gray-900">{sucursalModal.telefono}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => setSucursalModal(null)}
                className="w-full mt-6 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
