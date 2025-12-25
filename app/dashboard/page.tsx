// Path: app\dashboard\page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { formatCurrency } from '@/lib/utils/format'
import { formatDateTime, formatTime } from '@/lib/utils/timezone'
import Link from 'next/link'

interface DashboardStats {
  ventasHoy: number
  utilidadHoy: number
  cantidadVentasHoy: number
  totalProductos: number
  productosStockBajo: number
  productosSinStock: number
  totalClientes: number
  creditosPendientes: number
  montoCreditosPendientes: number
  traspasosRecibir: number
}

interface Caja {
  id: string
  estado: 'abierta' | 'cerrada'
  monto_inicial: number
  fecha_apertura: string
}

interface VentaReciente {
  id: string
  numero_venta: number
  total: number
  metodo_pago: string
  created_at: string
}

interface Alerta {
  tipo: 'warning' | 'error' | 'info'
  mensaje: string
  link?: string
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    ventasHoy: 0,
    utilidadHoy: 0,
    cantidadVentasHoy: 0,
    totalProductos: 0,
    productosStockBajo: 0,
    productosSinStock: 0,
    totalClientes: 0,
    creditosPendientes: 0,
    montoCreditosPendientes: 0,
    traspasosRecibir: 0
  })
  const [miCaja, setMiCaja] = useState<Caja | null>(null)
  const [ventasRecientes, setVentasRecientes] = useState<VentaReciente[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)
  const [sucursalNombre, setSucursalNombre] = useState('')

  const { usuario } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (usuario?.sucursal_id) {
      loadDashboardData()
    }
  }, [usuario?.sucursal_id])

  const loadDashboardData = async () => {
    if (!usuario?.sucursal_id || !usuario?.id) return

    setLoading(true)
    try {
      // Obtener nombre de sucursal
      const { data: sucursalData } = await supabase
        .from('sucursales')
        .select('nombre')
        .eq('id', usuario.sucursal_id)
        .single()
      
      if (sucursalData) {
        setSucursalNombre(sucursalData.nombre)
      }

      // Fecha de hoy (inicio del día)
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const hoyISO = hoy.toISOString()

      // 1. Ventas de hoy
      const { data: ventasHoy } = await supabase
        .from('ventas')
        .select('id, total, numero_venta, metodo_pago, created_at')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('estado', 'completada')
        .gte('created_at', hoyISO)
        .order('created_at', { ascending: false })

      // 2. Calcular utilidad (necesita detalles de venta)
      let utilidadHoy = 0
      if (ventasHoy && ventasHoy.length > 0) {
        const ventaIds = ventasHoy.map(v => v.id)
        const { data: detalles } = await supabase
          .from('venta_detalles')
          .select('cantidad, precio_unitario, costo_unitario')
          .in('venta_id', ventaIds)

        if (detalles) {
          utilidadHoy = detalles.reduce((sum, d) => {
            return sum + (d.precio_unitario - d.costo_unitario) * d.cantidad
          }, 0)
        }
      }

      // 3. Productos
      const { data: productos } = await supabase
        .from('productos')
        .select('id, stock_actual, stock_minimo')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('activo', true)

      const totalProductos = productos?.length || 0
      const productosSinStock = productos?.filter(p => p.stock_actual <= 0).length || 0
      const productosStockBajo = productos?.filter(p => p.stock_actual > 0 && p.stock_actual <= p.stock_minimo).length || 0

      // 4. Clientes
      const { count: totalClientes } = await supabase
        .from('clientes')
        .select('id', { count: 'exact', head: true })
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('activo', true)

      // 5. Créditos pendientes
      const { data: creditosData } = await supabase
        .from('creditos')
        .select('id, saldo_pendiente')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('estado', 'pendiente')

      const creditosPendientes = creditosData?.length || 0
      const montoCreditosPendientes = creditosData?.reduce((sum, c) => sum + c.saldo_pendiente, 0) || 0

      // 6. Traspasos por recibir
      const { count: traspasosRecibir } = await supabase
        .from('traspasos')
        .select('id', { count: 'exact', head: true })
        .eq('sucursal_destino_id', usuario.sucursal_id)
        .eq('estado', 'pendiente')

      // 7. Mi caja abierta
      const { data: cajaData } = await supabase
        .from('cajas')
        .select('id, estado, monto_inicial, fecha_apertura')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('usuario_id', usuario.id)
        .eq('estado', 'abierta')
        .maybeSingle()

      setMiCaja(cajaData)

      // Actualizar stats
      setStats({
        ventasHoy: ventasHoy?.reduce((sum, v) => sum + v.total, 0) || 0,
        utilidadHoy,
        cantidadVentasHoy: ventasHoy?.length || 0,
        totalProductos,
        productosStockBajo,
        productosSinStock,
        totalClientes: totalClientes || 0,
        creditosPendientes,
        montoCreditosPendientes,
        traspasosRecibir: traspasosRecibir || 0
      })

      // Ventas recientes (últimas 5)
      setVentasRecientes(ventasHoy?.slice(0, 5) || [])

      // Generar alertas
      const nuevasAlertas: Alerta[] = []
      
      if (!cajaData) {
        nuevasAlertas.push({
          tipo: 'warning',
          mensaje: 'Tu caja está cerrada. Ábrela para vender.',
          link: '/dashboard/caja'
        })
      }

      if (productosSinStock > 0) {
        nuevasAlertas.push({
          tipo: 'error',
          mensaje: `${productosSinStock} producto${productosSinStock > 1 ? 's' : ''} sin stock`,
          link: '/dashboard/productos'
        })
      }

      if (productosStockBajo > 0) {
        nuevasAlertas.push({
          tipo: 'warning',
          mensaje: `${productosStockBajo} producto${productosStockBajo > 1 ? 's' : ''} con stock bajo`,
          link: '/dashboard/productos'
        })
      }

      if (traspasosRecibir && traspasosRecibir > 0) {
        nuevasAlertas.push({
          tipo: 'info',
          mensaje: `${traspasosRecibir} traspaso${traspasosRecibir > 1 ? 's' : ''} pendiente${traspasosRecibir > 1 ? 's' : ''} de recibir`,
          link: '/dashboard/traspasos'
        })
      }

      if (creditosPendientes > 0) {
        nuevasAlertas.push({
          tipo: 'info',
          mensaje: `${creditosPendientes} crédito${creditosPendientes > 1 ? 's' : ''} pendiente${creditosPendientes > 1 ? 's' : ''} (${formatCurrency(montoCreditosPendientes)})`,
          link: '/dashboard/creditos'
        })
      }

      setAlertas(nuevasAlertas)

    } catch (err) {
      console.error('Error cargando dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  const getMetodoPagoIcon = (metodo: string) => {
    switch (metodo) {
      case 'efectivo':
        return (
          <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-green-600 text-xs">💵</span>
          </div>
        )
      case 'qr':
        return (
          <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
            <span className="text-purple-600 text-xs">📱</span>
          </div>
        )
      case 'credito':
        return (
          <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center">
            <span className="text-yellow-600 text-xs">📋</span>
          </div>
        )
      case 'mixto':
        return (
          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-blue-600 text-xs">🔀</span>
          </div>
        )
      default:
        return null
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
    <div className="p-4 pb-24 max-w-4xl mx-auto">
      {/* Saludo */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">¡Hola, {usuario?.nombre?.split(' ')[0]}!</h1>
        <p className="text-gray-500">{sucursalNombre}</p>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="space-y-2 mb-6">
          {alertas.map((alerta, index) => (
            <Link
              key={index}
              href={alerta.link || '#'}
              className={`block p-3 rounded-xl border ${
                alerta.tipo === 'error' 
                  ? 'bg-red-50 border-red-200 text-red-700' 
                  : alerta.tipo === 'warning'
                    ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                    : 'bg-blue-50 border-blue-200 text-blue-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>
                  {alerta.tipo === 'error' ? '⚠️' : alerta.tipo === 'warning' ? '⏰' : 'ℹ️'}
                </span>
                <span className="text-sm font-medium">{alerta.mensaje}</span>
                <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Stats principales */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Ventas Hoy */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-4 text-white">
          <p className="text-emerald-100 text-sm">Ventas Hoy</p>
          <p className="text-2xl font-bold">{formatCurrency(stats.ventasHoy)}</p>
          <p className="text-emerald-200 text-xs mt-1">{stats.cantidadVentasHoy} venta{stats.cantidadVentasHoy !== 1 ? 's' : ''}</p>
        </div>

        {/* Utilidad */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 text-white">
          <p className="text-blue-100 text-sm">Utilidad Hoy</p>
          <p className="text-2xl font-bold">{formatCurrency(stats.utilidadHoy)}</p>
          <p className="text-blue-200 text-xs mt-1">Ganancia estimada</p>
        </div>

        {/* Estado de caja */}
        <Link 
          href="/dashboard/caja"
          className={`rounded-2xl p-4 ${
            miCaja 
              ? 'bg-gradient-to-br from-green-500 to-green-600 text-white' 
              : 'bg-gray-100 text-gray-700 border-2 border-dashed border-gray-300'
          }`}
        >
          <p className={miCaja ? 'text-green-100 text-sm' : 'text-gray-500 text-sm'}>Mi Caja</p>
          <p className="text-xl font-bold">{miCaja ? 'Abierta' : 'Cerrada'}</p>
          {miCaja && (
            <p className="text-green-200 text-xs mt-1">
              Desde {formatTime(miCaja.fecha_apertura)}
            </p>
          )}
        </Link>

        {/* Productos */}
        <Link href="/dashboard/productos" className="bg-white rounded-2xl p-4 border border-gray-100">
          <p className="text-gray-500 text-sm">Productos</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalProductos}</p>
          {(stats.productosSinStock > 0 || stats.productosStockBajo > 0) && (
            <p className="text-xs mt-1">
              {stats.productosSinStock > 0 && (
                <span className="text-red-600">{stats.productosSinStock} sin stock</span>
              )}
              {stats.productosSinStock > 0 && stats.productosStockBajo > 0 && ' • '}
              {stats.productosStockBajo > 0 && (
                <span className="text-yellow-600">{stats.productosStockBajo} bajo</span>
              )}
            </p>
          )}
        </Link>
      </div>

      {/* Accesos rápidos */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Accesos Rápidos</h2>
        <div className="grid grid-cols-4 gap-3">
          <Link href="/dashboard/pos" className="flex flex-col items-center p-2 rounded-xl hover:bg-gray-50">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-700 text-center">Vender</span>
          </Link>

          <Link href="/dashboard/productos/nuevo" className="flex flex-col items-center p-2 rounded-xl hover:bg-gray-50">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-700 text-center">Producto</span>
          </Link>

          <Link href="/dashboard/compras" className="flex flex-col items-center p-2 rounded-xl hover:bg-gray-50">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-700 text-center">Comprar</span>
          </Link>

          <Link href="/dashboard/inventario" className="flex flex-col items-center p-2 rounded-xl hover:bg-gray-50">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-700 text-center">Inventario</span>
          </Link>
        </div>
      </div>

      {/* Ventas recientes */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Ventas Recientes</h2>
          <Link href="/dashboard/ventas" className="text-sm text-emerald-600 font-medium">
            Ver todas
          </Link>
        </div>

        {ventasRecientes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">No hay ventas hoy</p>
            <Link href="/dashboard/pos" className="text-emerald-600 text-sm font-medium mt-1 inline-block">
              Hacer primera venta →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {ventasRecientes.map(venta => (
              <Link
                key={venta.id}
                href={`/dashboard/ventas`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getMetodoPagoIcon(venta.metodo_pago)}
                  <div>
                    <p className="font-medium text-gray-900">Venta {venta.numero_venta}</p>
                    <p className="text-xs text-gray-500">{formatTime(venta.created_at)}</p>
                  </div>
                </div>
                <p className="font-bold text-emerald-600">{formatCurrency(venta.total)}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Resumen adicional */}
      <div className="grid grid-cols-2 gap-4 mt-6">
        <Link href="/dashboard/clientes" className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{stats.totalClientes}</p>
              <p className="text-xs text-gray-500">Clientes</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/creditos" className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{stats.creditosPendientes}</p>
              <p className="text-xs text-gray-500">Créditos pendientes</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}