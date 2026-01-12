// Path: app\dashboard\ventas\page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { formatCurrency } from '@/lib/utils/format'
import { formatDateTime } from '@/lib/utils/timezone'
import * as XLSX from 'xlsx'

interface VentaDetalle {
  id: string
  cantidad: number
  precio_unitario: number
  precio_original: number
  descuento_monto: number
  precio_final: number
  subtotal: number
  producto_nombre: string
  producto_codigo: string
  costo_unitario: number
}

interface Venta {
  id: string
  numero_venta: number
  total: number
  subtotal: number
  descuento: number
  metodo_pago: string
  monto_efectivo: number
  monto_qr: number
  monto_credito: number
  estado: string
  notas: string | null
  motivo_anulacion?: string | null
  anulada_por?: string | null
  anulada_at?: string | null
  created_at: string
  cliente_nombre: string | null
  cliente_telefono: string | null
  usuario_nombre: string | null
  caja_id: string
  cliente_id: string | null
  detalles: VentaDetalle[]
}

export default function VentasPage() {
  const [ventas, setVentas] = useState<Venta[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroFecha, setFiltroFecha] = useState<'hoy' | 'semanal' | 'mensual' | 'personalizado'>('hoy')
  const [filtroMetodo, setFiltroMetodo] = useState('todos')
  const [ventaSeleccionada, setVentaSeleccionada] = useState<Venta | null>(null)
  const [exportando, setExportando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Estados para filtro personalizado
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')

  // Estados para anulación
  const [showAnular, setShowAnular] = useState(false)
  const [motivoAnulacion, setMotivoAnulacion] = useState('')
  const [procesandoAnulacion, setProcesandoAnulacion] = useState(false)
  const [showExitoAnulacion, setShowExitoAnulacion] = useState(false)

  const { usuario } = useAuth()
  const supabase = createClient()


  useEffect(() => {
  if (usuario?.sucursal_id) {
    loadVentas()
  }
}, [usuario?.sucursal_id, filtroFecha, fechaInicio, fechaFin])

  const loadVentas = async () => {
    if (!usuario?.sucursal_id) return

    setLoading(true)
    setErrorMsg(null)
    
    try {
      const ahora = new Date()
let fechaInicioCalc: Date
let fechaFinCalc: Date = new Date(ahora)
fechaFinCalc.setHours(23, 59, 59, 999)

switch (filtroFecha) {
  case 'hoy':
    fechaInicioCalc = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
    break
  case 'semanal':
    fechaInicioCalc = new Date(ahora)
    fechaInicioCalc.setDate(ahora.getDate() - 7)
    fechaInicioCalc.setHours(0, 0, 0, 0)
    break
  case 'mensual':
    fechaInicioCalc = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
    fechaInicioCalc.setHours(0, 0, 0, 0)
    break
  case 'personalizado':
    if (fechaInicio && fechaFin) {
      fechaInicioCalc = new Date(fechaInicio)
      fechaInicioCalc.setHours(0, 0, 0, 0)
      fechaFinCalc = new Date(fechaFin)
      fechaFinCalc.setHours(23, 59, 59, 999)
    } else {
      // Si no hay fechas, usar hoy
      fechaInicioCalc = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
    }
    break
}

      // 1. Cargar ventas básicas
      const { data: ventasData, error: ventasError } = await supabase
        .from('ventas')
        .select('*')
        .eq('sucursal_id', usuario.sucursal_id)
        .gte('created_at', fechaInicioCalc.toISOString())
        .lte('created_at', fechaFinCalc.toISOString())
        .order('created_at', { ascending: false })

      if (ventasError) {
        console.error('Error cargando ventas:', ventasError)
        setErrorMsg(`Error: ${ventasError.message}`)
        setVentas([])
        return
      }

      if (!ventasData || ventasData.length === 0) {
        setVentas([])
        return
      }

      // 2. Obtener IDs únicos de clientes y usuarios
      const clienteIds = [...new Set(ventasData.filter(v => v.cliente_id).map(v => v.cliente_id))]
      const usuarioIds = [...new Set(ventasData.filter(v => v.usuario_id).map(v => v.usuario_id))]
      const ventaIds = ventasData.map(v => v.id)

      // 3. Cargar clientes
      let clientesMap: Record<string, { nombre: string; telefono: string }> = {}
      if (clienteIds.length > 0) {
        const { data: clientesData } = await supabase
          .from('clientes')
          .select('id, nombre, telefono')
          .in('id', clienteIds)
        
        if (clientesData) {
          clientesData.forEach(c => {
            clientesMap[c.id] = { nombre: c.nombre, telefono: c.telefono || '' }
          })
        }
      }

      // 4. Cargar usuarios
      let usuariosMap: Record<string, string> = {}
      if (usuarioIds.length > 0) {
        const { data: usuariosData } = await supabase
          .from('usuarios')
          .select('id, nombre')
          .in('id', usuarioIds)
        
        if (usuariosData) {
          usuariosData.forEach(u => {
            usuariosMap[u.id] = u.nombre
          })
        }
      }

      // 5. Cargar todos los detalles de ventas (AHORA INCLUYE descuento_monto y precio_final)
      const { data: detallesData } = await supabase
        .from('venta_detalles')
        .select('*')
        .in('venta_id', ventaIds)

      // 6. Obtener productos de los detalles
      let productosMap: Record<string, { nombre: string; codigo: string; precio_compra: number }> = {}
      if (detallesData && detallesData.length > 0) {
        const productoIds = [...new Set(detallesData.filter(d => d.producto_id).map(d => d.producto_id))]
        
        if (productoIds.length > 0) {
          const { data: productosData } = await supabase
            .from('productos')
            .select('id, nombre, codigo, precio_compra')
            .in('id', productoIds)
          
          if (productosData) {
            productosData.forEach(p => {
              productosMap[p.id] = { nombre: p.nombre, codigo: p.codigo || 'N/A', precio_compra: p.precio_compra || 0 }
            })
          }
        }
      }

      // 7. Armar objeto final de ventas
      const ventasCompletas: Venta[] = ventasData.map(venta => {
        // Filtrar detalles de esta venta
        const detallesVenta = (detallesData || [])
          .filter(d => d.venta_id === venta.id)
          .map(d => ({
            id: d.id,
            cantidad: d.cantidad,
            precio_unitario: d.precio_unitario,
            precio_original: d.precio_original || d.precio_unitario,
            descuento_monto: d.descuento_monto || 0,
            precio_final: d.precio_final || d.precio_unitario,
            subtotal: d.subtotal,
            producto_nombre: productosMap[d.producto_id]?.nombre || 'Producto eliminado',
            producto_codigo: productosMap[d.producto_id]?.codigo || 'N/A',
            costo_unitario: productosMap[d.producto_id]?.precio_compra || 0
          }))

        return {
          id: venta.id,
          numero_venta: venta.numero_venta,
          total: venta.total,
          subtotal: venta.subtotal,
          descuento: venta.descuento,
          metodo_pago: venta.metodo_pago,
          monto_efectivo: venta.monto_efectivo || 0,
          monto_qr: venta.monto_qr || 0,
          monto_credito: venta.monto_credito || 0,
          estado: venta.estado,
          notas: venta.notas,
          motivo_anulacion: venta.motivo_anulacion,
          anulada_por: venta.anulada_por,
          anulada_at: venta.anulada_at,
          created_at: venta.created_at,
          cliente_nombre: venta.cliente_id ? clientesMap[venta.cliente_id]?.nombre || null : null,
          cliente_telefono: venta.cliente_id ? clientesMap[venta.cliente_id]?.telefono || null : null,
          usuario_nombre: venta.usuario_id ? usuariosMap[venta.usuario_id] || null : null,
          caja_id: venta.caja_id,
          cliente_id: venta.cliente_id,
          detalles: detallesVenta
        }
      })

      setVentas(ventasCompletas)
    } catch (err) {
      console.error('Error cargando ventas:', err)
      setErrorMsg('Error al cargar las ventas')
      setVentas([])
    } finally {
      setLoading(false)
    }
  }

  // Filtrar ventas
  const ventasFiltradas = useMemo(() => {
    let resultado = [...ventas]

    if (filtroMetodo !== 'todos') {
      resultado = resultado.filter(v => v.metodo_pago === filtroMetodo)
    }

    return resultado
  }, [ventas, filtroMetodo])

  // Calcular totales
  const totales = useMemo(() => {
    const ventasActivas = ventasFiltradas.filter(v => v.estado !== 'anulada')
    return {
      cantidad: ventasActivas.length,
      total: ventasActivas.reduce((sum, v) => sum + v.total, 0),
      efectivo: ventasActivas.reduce((sum, v) => sum + v.monto_efectivo, 0),
      qr: ventasActivas.reduce((sum, v) => sum + v.monto_qr, 0),
      credito: ventasActivas.reduce((sum, v) => sum + v.monto_credito, 0)
    }
  }, [ventasFiltradas])

  // Exportar a Excel
  const exportarExcel = async () => {
    setExportando(true)
    try {
      const ventasExport = ventasFiltradas.map(v => ({
        'N° Venta': v.numero_venta,
        'Fecha': formatDateTime(v.created_at),
        'Cliente': v.cliente_nombre || 'Público General',
        'Método Pago': v.metodo_pago.toUpperCase(),
        'Subtotal': v.subtotal,
        'Descuento': v.descuento,
        'Total': v.total,
        'Estado': v.estado.toUpperCase(),
        'Vendedor': v.usuario_nombre || 'N/A'
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(ventasExport)
      XLSX.utils.book_append_sheet(wb, ws, 'Ventas')
      XLSX.writeFile(wb, `ventas-${new Date().getTime()}.xlsx`)
    } catch (err) {
      console.error('Error exportando:', err)
    } finally {
      setExportando(false)
    }
  }

  // Anular venta
  const anularVenta = async () => {
    if (!ventaSeleccionada || !usuario?.id) return
    if (motivoAnulacion.trim().length < 10) return

    setProcesandoAnulacion(true)
    try {
      // 1. Marcar venta como anulada
      const { error: ventaError } = await supabase
        .from('ventas')
        .update({
          estado: 'anulada',
          motivo_anulacion: motivoAnulacion.trim(),
          anulada_por: usuario.id,
          anulada_at: new Date().toISOString()
        })
        .eq('id', ventaSeleccionada.id)

      if (ventaError) throw ventaError

      // 2. Devolver stock de productos
      for (const detalle of ventaSeleccionada.detalles) {
        const { data: producto } = await supabase
          .from('productos')
          .select('stock_actual')
          .eq('id', detalle.id)
          .single()

        if (producto) {
          await supabase
            .from('productos')
            .update({ stock_actual: producto.stock_actual + detalle.cantidad })
            .eq('id', detalle.id)
        }
      }

      // 3. Crear movimientos inversos en caja
      if (ventaSeleccionada.monto_efectivo > 0) {
        await supabase.from('movimientos_caja').insert({
          caja_id: ventaSeleccionada.caja_id,
          tipo: 'egreso',
          concepto: `Anulación Venta ${ventaSeleccionada.numero_venta}`,
          referencia_id: ventaSeleccionada.id,
          referencia_tipo: 'anulacion_venta',
          monto: ventaSeleccionada.monto_efectivo,
          metodo_pago: 'efectivo'
        })
      }

      if (ventaSeleccionada.monto_qr > 0) {
        await supabase.from('movimientos_caja').insert({
          caja_id: ventaSeleccionada.caja_id,
          tipo: 'egreso',
          concepto: `Anulación Venta ${ventaSeleccionada.numero_venta}`,
          referencia_id: ventaSeleccionada.id,
          referencia_tipo: 'anulacion_venta',
          monto: ventaSeleccionada.monto_qr,
          metodo_pago: 'qr'
        })
      }

      // 4. Registrar en auditoría
      await supabase.from('auditoria').insert({
        usuario_id: usuario.id,
        accion: 'anular_venta',
        tabla: 'ventas',
        registro_id: ventaSeleccionada.id,
        datos_anteriores: { estado: 'completada' },
        datos_nuevos: { 
          estado: 'anulada', 
          motivo: motivoAnulacion.trim(),
          anulada_por: usuario.id 
        }
      })

      // Cerrar modales y recargar
      setShowAnular(false)
      setMotivoAnulacion('')
      setVentaSeleccionada(null)
      setShowExitoAnulacion(true)
      
      loadVentas()

      setTimeout(() => setShowExitoAnulacion(false), 3000)

    } catch (err) {
      console.error('Error anulando venta:', err)
      alert('Error al anular la venta')
    } finally {
      setProcesandoAnulacion(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando ventas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historial de Ventas</h1>
          <p className="text-gray-500 text-sm mt-1">Gestiona y consulta tus ventas</p>
        </div>
        <button
          onClick={exportarExcel}
          disabled={exportando || ventasFiltradas.length === 0}
          className="px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2"
        >
          {exportando ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Exportando...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Excel
            </>
          )}
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-4">
        {/* Filtros de fecha predefinidos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['hoy', 'semanal', 'mensual', 'personalizado'] as const).map(periodo => (
              <button
                key={periodo}
                onClick={() => setFiltroFecha(periodo)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  filtroFecha === periodo
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {periodo === 'hoy' && 'Hoy'}
                {periodo === 'semanal' && 'Última Semana'}
                {periodo === 'mensual' && 'Este Mes'}
                {periodo === 'personalizado' && 'Personalizado'}
              </button>
            ))}
          </div>
        </div>

        {/* Filtro personalizado con fechas */}
        {filtroFecha === 'personalizado' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>
        )}

        {/* Filtro por método de pago */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Método de pago</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {['todos', 'efectivo', 'qr', 'credito', 'mixto'].map(metodo => (
              <button
                key={metodo}
                onClick={() => setFiltroMetodo(metodo)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  filtroMetodo === metodo
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {metodo === 'todos' ? 'Todos' : metodo.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-gray-500 text-sm">Total Ventas</p>
          <p className="text-2xl font-bold text-gray-900">{totales.cantidad}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-gray-500 text-sm">💵 Efectivo</p>
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totales.efectivo)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-gray-500 text-sm">📱 QR</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totales.qr)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-gray-500 text-sm">💳 Crédito</p>
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(totales.credito)}</p>
        </div>
      </div>

      {/* Mensaje de error */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-red-700 text-sm">{errorMsg}</p>
        </div>
      )}

      {/* Lista de ventas */}
      {ventasFiltradas.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500">No hay ventas en este período</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ventasFiltradas.map(venta => (
            <div
              key={venta.id}
              onClick={() => setVentaSeleccionada(venta)}
              className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${
                venta.estado === 'anulada' 
                  ? 'border-red-200 bg-red-50/50' 
                  : 'border-gray-200 hover:border-emerald-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    venta.estado === 'anulada' ? 'bg-red-100' : 'bg-emerald-100'
                  }`}>
                    {venta.estado === 'anulada' ? (
                      <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Venta {venta.numero_venta}</h3>
                    <p className="text-xs text-gray-500">{formatDateTime(venta.created_at)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xl font-bold ${
                    venta.estado === 'anulada' ? 'text-red-600 line-through' : 'text-emerald-600'
                  }`}>
                    {formatCurrency(venta.total)}
                  </p>
                  <p className="text-xs text-gray-500 uppercase">{venta.metodo_pago}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {venta.cliente_nombre || 'Público General'}
                </span>
                <span className="text-gray-400">
                  {venta.detalles.length} {venta.detalles.length === 1 ? 'producto' : 'productos'}
                </span>
              </div>

              {venta.estado === 'anulada' && (
                <div className="mt-2 pt-2 border-t border-red-200">
                  <p className="text-xs text-red-600 font-medium">⚠️ VENTA ANULADA</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de detalle de venta */}
      {ventaSeleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    ventaSeleccionada.estado === 'anulada' ? 'bg-red-100' : 'bg-emerald-100'
                  }`}>
                    {ventaSeleccionada.estado === 'anulada' ? (
                      <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Venta {ventaSeleccionada.numero_venta}</h2>
                    <p className="text-sm text-gray-500">{formatDateTime(ventaSeleccionada.created_at)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setVentaSeleccionada(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Información general */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Cliente</span>
                  <p className="font-medium">{ventaSeleccionada.cliente_nombre || 'Público General'}</p>
                  {ventaSeleccionada.cliente_telefono && (
                    <p className="text-xs text-gray-400">{ventaSeleccionada.cliente_telefono}</p>
                  )}
                </div>
                <div>
                  <span className="text-gray-500">Método de pago</span>
                  <p className="font-medium uppercase">{ventaSeleccionada.metodo_pago}</p>
                </div>
                {ventaSeleccionada.usuario_nombre && (
                  <div>
                    <span className="text-gray-500">Vendedor</span>
                    <p className="font-medium">{ventaSeleccionada.usuario_nombre}</p>
                  </div>
                )}
              </div>

              {/* Desglose de pago para mixto */}
              {ventaSeleccionada.metodo_pago === 'mixto' && (
                <div className="p-3 bg-gray-50 rounded-lg text-sm mt-4">
                  <p className="font-medium text-gray-700 mb-2">Desglose de pago:</p>
                  <div className="flex justify-between">
                    <span>💵 Efectivo:</span>
                    <span>{formatCurrency(ventaSeleccionada.monto_efectivo)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>📱 QR:</span>
                    <span>{formatCurrency(ventaSeleccionada.monto_qr)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Productos */}
            <div className="p-6">
              <h3 className="font-medium text-gray-900 mb-3">Productos ({ventaSeleccionada.detalles.length})</h3>
              <div className="space-y-3">
                {ventaSeleccionada.detalles.map((detalle) => (
                  <div key={detalle.id} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{detalle.producto_nombre}</p>
                      <div className="text-xs text-gray-500 mt-1 space-y-1">
                        {/* Determinar qué se hizo: precio editado, descuento, o ambos */}
                        {(() => {
                          const precioEditado = detalle.precio_unitario !== detalle.precio_original
                          const tieneDescuento = detalle.descuento_monto > 0
                          
                          if (precioEditado && !tieneDescuento) {
                            // Solo se editó el precio
                            return (
                              <p>
                                {detalle.cantidad} unidad{detalle.cantidad !== 1 ? 'es' : ''} 
                                <span className="ml-2">
                                  📝 <span className="text-amber-600 font-medium">Precio editado:</span>
                                  <span className="line-through text-gray-400 ml-1">
                                    {formatCurrency(detalle.precio_original)}
                                  </span>
                                  <span className="text-amber-600 font-medium ml-1">
                                    → {formatCurrency(detalle.precio_unitario)} c/u
                                  </span>
                                </span>
                              </p>
                            )
                          } else if (tieneDescuento && !precioEditado) {
                            // Solo se aplicó descuento
                            return (
                              <>
                                <p>
                                  {detalle.cantidad} unidad{detalle.cantidad !== 1 ? 'es' : ''} × {formatCurrency(detalle.precio_original)} c/u
                                </p>
                                <p className="text-red-600 font-medium">
                                  🏷️ Descuento: -{formatCurrency(detalle.descuento_monto)} total
                                </p>
                              </>
                            )
                          } else if (tieneDescuento && precioEditado) {
                            // Se editó precio Y se aplicó descuento
                            return (
                              <>
                                <p>
                                  {detalle.cantidad} unidad{detalle.cantidad !== 1 ? 'es' : ''}
                                  <span className="ml-2">
                                    📝 <span className="text-amber-600 font-medium">Precio editado:</span>
                                    <span className="line-through text-gray-400 ml-1">
                                      {formatCurrency(detalle.precio_original)}
                                    </span>
                                    <span className="text-amber-600 font-medium ml-1">
                                      → {formatCurrency(detalle.precio_unitario)} c/u
                                    </span>
                                  </span>
                                </p>
                                <p className="text-red-600 font-medium">
                                  🏷️ Descuento adicional: -{formatCurrency(detalle.descuento_monto)} total
                                </p>
                              </>
                            )
                          } else {
                            // No se editó nada, precio normal
                            return (
                              <p>
                                {detalle.cantidad} unidad{detalle.cantidad !== 1 ? 'es' : ''} × {formatCurrency(detalle.precio_unitario)} c/u
                              </p>
                            )
                          }
                        })()}
                      </div>
                    </div>
                    <p className="font-medium text-gray-900">{formatCurrency(detalle.subtotal)}</p>
                  </div>
                ))}
              </div>

              {/* Totales */}
              <div className="border-t border-gray-100 mt-4 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{formatCurrency(ventaSeleccionada.subtotal)}</span>
                </div>
                {ventaSeleccionada.descuento > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Descuento</span>
                    <span>-{formatCurrency(ventaSeleccionada.descuento)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-100">
                  <span>Total</span>
                  <span className={ventaSeleccionada.estado === 'anulada' ? 'text-red-600 line-through' : 'text-emerald-600'}>
                    {formatCurrency(ventaSeleccionada.total)}
                  </span>
                </div>
              </div>

              {/* Notas */}
              {ventaSeleccionada.notas && (
                <div className="p-3 bg-amber-50 rounded-lg mt-4">
                  <p className="text-sm text-amber-700">
                    <strong>Notas:</strong> {ventaSeleccionada.notas}
                  </p>
                </div>
              )}

              {/* Mensaje venta anulada con motivo */}
              {ventaSeleccionada.estado === 'anulada' && (
                <div className="p-4 bg-red-50 rounded-lg border border-red-200 mt-4">
                  <p className="text-red-700 text-sm font-bold mb-2">⚠️ Esta venta fue anulada</p>
                  {ventaSeleccionada.motivo_anulacion && (
                    <p className="text-red-600 text-sm">
                      <strong>Motivo:</strong> {ventaSeleccionada.motivo_anulacion}
                    </p>
                  )}
                  {ventaSeleccionada.anulada_at && (
                    <p className="text-red-500 text-xs mt-1">
                      {formatDateTime(ventaSeleccionada.anulada_at)}
                    </p>
                  )}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-100 space-y-3">
              {/* Botón Anular - Solo para gerente/admin y venta no anulada */}
              {(usuario?.rol === 'gerente' || usuario?.rol === 'admin') && 
               ventaSeleccionada.estado !== 'anulada' && (
                <button
                  onClick={() => setShowAnular(true)}
                  className="w-full px-4 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 font-medium"
                >
                  ❌ Anular Venta
                </button>
              )}

              <button
                onClick={() => setVentaSeleccionada(null)}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación anulación */}
      {showAnular && ventaSeleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl w-full max-w-md animate-bounce-in">
            <div className="p-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
                ¿Anular Venta {ventaSeleccionada.numero_venta}?
              </h3>
              <p className="text-gray-500 text-center text-sm mb-4">
                Esta acción devolverá el stock y creará movimientos inversos en caja
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo de anulación (mínimo 10 caracteres) *
                </label>
                <textarea
                  value={motivoAnulacion}
                  onChange={(e) => setMotivoAnulacion(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none resize-none"
                  rows={3}
                  placeholder="Ejemplo: Cliente solicitó cancelación, error en venta, etc."
                  disabled={procesandoAnulacion}
                />
                <p className="text-xs text-gray-400 mt-1">
                  {motivoAnulacion.length}/10 caracteres mínimos
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAnular(false)
                    setMotivoAnulacion('')
                  }}
                  disabled={procesandoAnulacion}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={anularVenta}
                  disabled={procesandoAnulacion || motivoAnulacion.trim().length < 10}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {procesandoAnulacion ? 'Anulando...' : 'Confirmar Anulación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de éxito anulación */}
      {showExitoAnulacion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full animate-bounce-in">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Venta Anulada!</h2>
            <p className="text-gray-500">Stock devuelto y movimientos registrados correctamente</p>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes bounce-in {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-bounce-in {
          animation: bounce-in 0.4s ease-out;
        }
      `}</style>
    </div>
  )
}