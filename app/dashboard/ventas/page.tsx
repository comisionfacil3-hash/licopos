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
  const [filtroFecha, setFiltroFecha] = useState<'hoy' | 'semanal' | 'mensual'>('hoy')
  const [filtroMetodo, setFiltroMetodo] = useState('todos')
  const [ventaSeleccionada, setVentaSeleccionada] = useState<Venta | null>(null)
  const [exportando, setExportando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

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
}, [usuario?.sucursal_id, filtroFecha])

  const loadVentas = async () => {
    if (!usuario?.sucursal_id) return

    setLoading(true)
    setErrorMsg(null)
    
    try {
      const ahora = new Date()
let fechaInicio: Date
let fechaFin: Date = new Date(ahora)
fechaFin.setHours(23, 59, 59, 999)

switch (filtroFecha) {
  case 'hoy':
    fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
    break
  case 'semanal':
    fechaInicio = new Date(ahora)
    fechaInicio.setDate(ahora.getDate() - 7)
    fechaInicio.setHours(0, 0, 0, 0)
    break
  case 'mensual':
    fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
    fechaInicio.setHours(0, 0, 0, 0)
    break
}

      // 1. Cargar ventas básicas
      const { data: ventasData, error: ventasError } = await supabase
        .from('ventas')
        .select('*')
        .eq('sucursal_id', usuario.sucursal_id)
        .gte('created_at', fechaInicio.toISOString())
        .lte('created_at', fechaFin.toISOString())
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

      // 5. Cargar todos los detalles de ventas
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
          descuento: venta.descuento || 0,
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
    } catch (err: any) {
      console.error('Error general:', err)
      setErrorMsg(err?.message || 'Error desconocido')
      setVentas([])
    } finally {
      setLoading(false)
    }
  }

  // Filtrar ventas por método de pago
  const ventasFiltradas = useMemo(() => {
    if (filtroMetodo === 'todos') return ventas
    return ventas.filter(v => v.metodo_pago === filtroMetodo)
  }, [ventas, filtroMetodo])

  const ventasCompletadas = ventasFiltradas.filter(v => v.estado === 'completada')
  const ventasAnuladas = ventasFiltradas.filter(v => v.estado === 'anulada')
  const totalVentas = ventasCompletadas.reduce((sum, v) => sum + v.total, 0)
  const totalEfectivo = ventasCompletadas.reduce((sum, v) => sum + v.monto_efectivo, 0)
  const totalQR = ventasCompletadas.reduce((sum, v) => sum + v.monto_qr, 0)

  const getMetodoPagoIcon = (metodo: string) => {
    switch (metodo) {
      case 'efectivo': return '💵'
      case 'qr': return '📱'
      case 'credito': return '📝'
      case 'mixto': return '🔄'
      default: return '💰'
    }
  }

  const getMetodoPagoText = (metodo: string) => {
    switch (metodo) {
      case 'efectivo': return 'Efectivo'
      case 'qr': return 'QR'
      case 'credito': return 'Crédito'
      case 'mixto': return 'Mixto'
      default: return metodo
    }
  }

  // Exportar a Excel por productos
  const exportarExcel = () => {
    if (ventasFiltradas.length === 0) return
    
    setExportando(true)
    
    try {
      const datosExcel: any[] = []
      
      ventasFiltradas.forEach(venta => {
        if (venta.estado === 'anulada') return
        
        venta.detalles.forEach(detalle => {
          datosExcel.push({
            'Venta #': venta.numero_venta,
            'Fecha': formatDateTime(venta.created_at),
            'Producto': detalle.producto_nombre,
            'Código': detalle.producto_codigo,
            'Cantidad': detalle.cantidad,
            'Costo Unit.': detalle.costo_unitario,
            'Costo Total': detalle.costo_unitario * detalle.cantidad,
            'Precio Unit.': detalle.precio_unitario,
            'Subtotal': detalle.subtotal,
            'Utilidad': detalle.subtotal - (detalle.costo_unitario * detalle.cantidad),
            'Método Pago': getMetodoPagoText(venta.metodo_pago),
            'Cliente': venta.cliente_nombre || 'Sin cliente',
            'Vendedor': venta.usuario_nombre || 'N/A',
            'Total Venta': venta.total
          })
        })
      })

      const resumen = [
        { Concepto: 'Período', Valor: filtroFecha === 'hoy' ? 'Hoy' : filtroFecha === 'semanal' ? 'Última semana' : 'Este mes' },
        { Concepto: 'Total Ventas', Valor: ventasCompletadas.length },
        { Concepto: 'Total Vendido', Valor: formatCurrency(totalVentas) },
        { Concepto: 'Total Efectivo', Valor: formatCurrency(totalEfectivo) },
        { Concepto: 'Total QR', Valor: formatCurrency(totalQR) },
        { Concepto: 'Ventas Anuladas', Valor: ventasAnuladas.length },
      ]

      const wb = XLSX.utils.book_new()
      
      const wsDetalle = XLSX.utils.json_to_sheet(datosExcel)
      XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle por Producto')
      
      const wsResumen = XLSX.utils.json_to_sheet(resumen)
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

      const fileName = `Ventas_Filtro.xlsx`
      XLSX.writeFile(wb, fileName)
      
    } catch (err) {
      console.error('Error exportando:', err)
      alert('Error al exportar el archivo')
    } finally {
      setExportando(false)
    }
  }

  // 🔴 ANULAR VENTA (SOLO GERENTE)
  const anularVenta = async () => {
    if (!ventaSeleccionada || !usuario) return

    // Validaciones
    if (motivoAnulacion.trim().length < 10) {
      alert('El motivo debe tener al menos 10 caracteres')
      return
    }

    if (ventaSeleccionada.estado === 'anulada') {
      alert('Esta venta ya fue anulada')
      return
    }

    setProcesandoAnulacion(true)

    try {
      // 1. Actualizar estado de la venta
      const { error: ventaError } = await supabase
        .from('ventas')
        .update({
          estado: 'anulada',
          motivo_anulacion: motivoAnulacion,
          anulada_por: usuario.id,
          anulada_at: new Date().toISOString()
        })
        .eq('id', ventaSeleccionada.id)

      if (ventaError) throw ventaError

      // 2. Devolver stock a productos (por cada detalle)
      for (const detalle of ventaSeleccionada.detalles) {
        // Buscar el producto por código
        const { data: productoData } = await supabase
          .from('productos')
          .select('id, stock_actual')
          .eq('codigo', detalle.producto_codigo)
          .eq('sucursal_id', usuario.sucursal_id)
          .single()

        if (productoData) {
          await supabase
            .from('productos')
            .update({ stock_actual: productoData.stock_actual + detalle.cantidad })
            .eq('id', productoData.id)
        }
      }

      // 3. Crear movimientos inversos en caja (egresos)
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

      // 4. Anular crédito si existe
      if (ventaSeleccionada.cliente_id && ventaSeleccionada.monto_credito > 0) {
        await supabase
          .from('creditos')
          .update({ estado: 'cancelado' })
          .eq('venta_id', ventaSeleccionada.id)
      }

      // Éxito
      setShowAnular(false)
      setVentaSeleccionada(null)
      setShowExitoAnulacion(true)
      setMotivoAnulacion('')
      
      // Recargar ventas
      loadVentas()

      // Ocultar mensaje después de 3 segundos
      setTimeout(() => {
        setShowExitoAnulacion(false)
      }, 3000)

    } catch (error) {
      console.error('Error anulando venta:', error)
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
    <div className="p-4 pb-24 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historial de Ventas</h1>
          <p className="text-gray-500 text-sm">{ventasFiltradas.length} ventas en el período</p>
        </div>
        <button
          onClick={exportarExcel}
          disabled={exportando || ventasFiltradas.length === 0}
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 font-medium flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {exportando ? 'Exportando...' : 'Exportar Excel'}
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {errorMsg}
        </div>
      )}

      {/* Filtros de fecha */}
      <div className="flex gap-2 mb-4">
        {(['hoy', 'semanal', 'mensual'] as const).map(filtro => (
            <button
            key={filtro}
            onClick={() => setFiltroFecha(filtro)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                filtroFecha === filtro
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
            >
            {filtro === 'hoy' ? '📅 Hoy' : filtro === 'semanal' ? '📆 Semanal' : '🗓️ Mensual'}
            </button>
        ))}
        </div>

      {/* Filtro de método de pago */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {['todos', 'efectivo', 'qr', 'credito', 'mixto'].map(metodo => (
          <button
            key={metodo}
            onClick={() => setFiltroMetodo(metodo)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex items-center gap-1 ${
              filtroMetodo === metodo
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {metodo !== 'todos' && getMetodoPagoIcon(metodo)}
            <span className="capitalize">{metodo === 'todos' ? 'Todos' : getMetodoPagoText(metodo)}</span>
          </button>
        ))}
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-emerald-50 rounded-xl p-3 text-center">
          <p className="text-emerald-600 font-bold text-lg">{formatCurrency(totalVentas)}</p>
          <p className="text-emerald-700 text-xs">Total</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <p className="text-blue-600 font-bold text-lg">{ventasCompletadas.length}</p>
          <p className="text-blue-700 text-xs">Ventas</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 text-center">
          <p className="text-amber-600 font-bold text-lg">{formatCurrency(totalEfectivo)}</p>
          <p className="text-amber-700 text-xs">💵 Efectivo</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-3 text-center">
          <p className="text-purple-600 font-bold text-lg">{formatCurrency(totalQR)}</p>
          <p className="text-purple-700 text-xs">📱 QR</p>
        </div>
      </div>

      {ventasFiltradas.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No hay ventas</h3>
          <p className="text-gray-500">No se encontraron ventas en este período</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ventasFiltradas.map(venta => (
            <div
              key={venta.id}
              onClick={() => setVentaSeleccionada(venta)}
              className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow ${
                venta.estado === 'anulada' ? 'border-red-200 bg-red-50/50' : 'border-gray-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">Venta {venta.numero_venta}</span>
                    {venta.estado === 'anulada' && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Anulada</span>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm">{formatDateTime(venta.created_at)}</p>
                  {venta.cliente_nombre && (
                    <p className="text-gray-400 text-xs mt-1">👤 {venta.cliente_nombre}</p>
                  )}
                  <p className="text-gray-400 text-xs">{venta.detalles.length} productos</p>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-lg ${venta.estado === 'anulada' ? 'text-red-600 line-through' : 'text-gray-900'}`}>
                    {formatCurrency(venta.total)}
                  </p>
                  {venta.descuento > 0 && (
                    <p className="text-xs text-red-500">
                      -{formatCurrency(venta.descuento)} de descuento
                    </p>
                  )}
                  <p className="text-sm mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      venta.metodo_pago === 'efectivo' ? 'bg-green-100 text-green-700' :
                      venta.metodo_pago === 'qr' ? 'bg-purple-100 text-purple-700' :
                      venta.metodo_pago === 'credito' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {getMetodoPagoIcon(venta.metodo_pago)} {getMetodoPagoText(venta.metodo_pago)}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de detalle de venta */}
      {ventaSeleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Venta {ventaSeleccionada.numero_venta}
                  </h2>
                  {ventaSeleccionada.estado === 'anulada' && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Anulada</span>
                  )}
                </div>
                <button
                  onClick={() => setVentaSeleccionada(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Info general */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Fecha</span>
                  <p className="font-medium">{formatDateTime(ventaSeleccionada.created_at)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Método de pago</span>
                  <p className="font-medium">
                    {getMetodoPagoIcon(ventaSeleccionada.metodo_pago)} {getMetodoPagoText(ventaSeleccionada.metodo_pago)}
                  </p>
                </div>
                {ventaSeleccionada.cliente_nombre && (
                  <div>
                    <span className="text-gray-500">Cliente</span>
                    <p className="font-medium">{ventaSeleccionada.cliente_nombre}</p>
                    {ventaSeleccionada.cliente_telefono && (
                      <p className="text-xs text-gray-400">{ventaSeleccionada.cliente_telefono}</p>
                    )}
                  </div>
                )}
                {ventaSeleccionada.usuario_nombre && (
                  <div>
                    <span className="text-gray-500">Vendedor</span>
                    <p className="font-medium">{ventaSeleccionada.usuario_nombre}</p>
                  </div>
                )}
              </div>

              {/* Desglose de pago para mixto */}
              {ventaSeleccionada.metodo_pago === 'mixto' && (
                <div className="p-3 bg-gray-50 rounded-lg text-sm">
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

              {/* Productos */}
              <div className="border-t border-gray-100 pt-4">
                <h3 className="font-medium text-gray-900 mb-3">Productos ({ventaSeleccionada.detalles.length})</h3>
                <div className="space-y-3">
                  {ventaSeleccionada.detalles.map((detalle) => (
                    <div key={detalle.id} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{detalle.producto_nombre}</p>
                        <p className="text-xs text-gray-500">
                          {detalle.cantidad} x {formatCurrency(detalle.precio_unitario)}
                          {detalle.precio_unitario !== detalle.precio_original && (
                            <span className="ml-2 text-amber-600">
                              (Original: {formatCurrency(detalle.precio_original)})
                            </span>
                          )}
                        </p>
                      </div>
                      <p className="font-medium text-gray-900">{formatCurrency(detalle.subtotal)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totales */}
              <div className="border-t border-gray-100 pt-4 space-y-2">
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
                <div className="p-3 bg-amber-50 rounded-lg">
                  <p className="text-sm text-amber-700">
                    <strong>Notas:</strong> {ventaSeleccionada.notas}
                  </p>
                </div>
              )}

              {/* Mensaje venta anulada con motivo */}
              {ventaSeleccionada.estado === 'anulada' && (
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
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
    </div>
  )
}