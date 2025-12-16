'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { formatCurrency } from '@/lib/utils/format'
import { formatDateTime, formatDate } from '@/lib/utils/timezone'
import * as XLSX from 'xlsx'

interface Cliente {
  id: string
  nombre: string
  telefono: string | null
}

interface Credito {
  id: string
  venta_id: string
  numero_venta: number
  cliente_id: string
  cliente_nombre: string
  cliente_telefono: string | null
  monto_total: number
  monto_pagado: number
  saldo_pendiente: number
  estado: 'pendiente' | 'pagado' | 'vencido'
  fecha_vencimiento: string | null
  notas: string | null
  created_at: string
}

interface PagoCredito {
  id: string
  monto: number
  metodo_pago: string
  notas: string | null
  created_at: string
  usuario_nombre: string
}

export default function CreditosPage() {
  const [creditos, setCreditos] = useState<Credito[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'pendiente' | 'pagado'>('pendiente')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [creditoSeleccionado, setCreditoSeleccionado] = useState<Credito | null>(null)
  const [pagosCredito, setPagosCredito] = useState<PagoCredito[]>([])
  const [loadingPagos, setLoadingPagos] = useState(false)
  
  // Estados para nuevo pago
  const [showNuevoPago, setShowNuevoPago] = useState(false)
  const [montoPago, setMontoPago] = useState('')
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'qr'>('efectivo')
  const [notasPago, setNotasPago] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [cajaAbierta, setCajaAbierta] = useState(false)
  const [cajaId, setCajaId] = useState<string | null>(null)
  
  // Estado para éxito
  const [showExito, setShowExito] = useState(false)

  const { usuario } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (usuario?.sucursal_id) {
      loadData()
    }
  }, [usuario?.sucursal_id])

  const loadData = async () => {
    if (!usuario?.sucursal_id) return

    setLoading(true)
    try {
      // Verificar caja abierta
      const { data: cajaData } = await supabase
        .from('cajas')
        .select('id')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('estado', 'abierta')
        .maybeSingle()

      setCajaAbierta(!!cajaData)
      setCajaId(cajaData?.id || null)

      // Cargar créditos
      const { data: creditosData } = await supabase
        .from('creditos')
        .select('*')
        .eq('sucursal_id', usuario.sucursal_id)
        .order('created_at', { ascending: false })

      if (creditosData && creditosData.length > 0) {
        // Obtener IDs únicos
        const clienteIds = [...new Set(creditosData.map(c => c.cliente_id))]
        const ventaIds = [...new Set(creditosData.map(c => c.venta_id))]

        // Cargar clientes
        let clientesMap: Record<string, { nombre: string, telefono: string | null }> = {}
        if (clienteIds.length > 0) {
          const { data: cliData } = await supabase
            .from('clientes')
            .select('id, nombre, telefono')
            .in('id', clienteIds)
          if (cliData) {
            cliData.forEach(c => { clientesMap[c.id] = { nombre: c.nombre, telefono: c.telefono } })
          }
        }

        // Cargar ventas para obtener número
        let ventasMap: Record<string, number> = {}
        if (ventaIds.length > 0) {
          const { data: ventaData } = await supabase
            .from('ventas')
            .select('id, numero_venta')
            .in('id', ventaIds)
          if (ventaData) {
            ventaData.forEach(v => { ventasMap[v.id] = v.numero_venta })
          }
        }

        const creditosCompletos: Credito[] = creditosData.map(credito => ({
          id: credito.id,
          venta_id: credito.venta_id,
          numero_venta: ventasMap[credito.venta_id] || 0,
          cliente_id: credito.cliente_id,
          cliente_nombre: clientesMap[credito.cliente_id]?.nombre || 'Cliente eliminado',
          cliente_telefono: clientesMap[credito.cliente_id]?.telefono || null,
          monto_total: credito.monto_total,
          monto_pagado: credito.monto_pagado,
          saldo_pendiente: credito.saldo_pendiente,
          estado: credito.estado,
          fecha_vencimiento: credito.fecha_vencimiento,
          notas: credito.notas,
          created_at: credito.created_at
        }))

        setCreditos(creditosCompletos)
      } else {
        setCreditos([])
      }

      // Cargar lista de clientes para filtro
      const { data: clientesData } = await supabase
        .from('clientes')
        .select('id, nombre, telefono')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('activo', true)
        .order('nombre')

      setClientes(clientesData || [])

    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }

  // Cargar pagos de un crédito
  const cargarPagos = async (creditoId: string) => {
    setLoadingPagos(true)
    try {
      const { data: pagosData } = await supabase
        .from('pagos_credito')
        .select('*')
        .eq('credito_id', creditoId)
        .order('created_at', { ascending: false })

      if (pagosData && pagosData.length > 0) {
        const usuarioIds = [...new Set(pagosData.map(p => p.usuario_id))]
        let usuariosMap: Record<string, string> = {}
        
        if (usuarioIds.length > 0) {
          const { data: usrData } = await supabase
            .from('usuarios')
            .select('id, nombre')
            .in('id', usuarioIds)
          if (usrData) {
            usrData.forEach(u => { usuariosMap[u.id] = u.nombre })
          }
        }

        const pagosCompletos: PagoCredito[] = pagosData.map(pago => ({
          id: pago.id,
          monto: pago.monto,
          metodo_pago: pago.metodo_pago,
          notas: pago.notas,
          created_at: pago.created_at,
          usuario_nombre: usuariosMap[pago.usuario_id] || 'Desconocido'
        }))

        setPagosCredito(pagosCompletos)
      } else {
        setPagosCredito([])
      }
    } catch (err) {
      console.error('Error cargando pagos:', err)
    } finally {
      setLoadingPagos(false)
    }
  }

  // Filtrar créditos
  const creditosFiltrados = useMemo(() => {
    let resultado = creditos

    if (filtroEstado !== 'todos') {
      resultado = resultado.filter(c => c.estado === filtroEstado)
    }

    if (filtroCliente) {
      resultado = resultado.filter(c => c.cliente_id === filtroCliente)
    }

    return resultado
  }, [creditos, filtroEstado, filtroCliente])

  // Totales
  const totalPendiente = creditosFiltrados
    .filter(c => c.estado === 'pendiente')
    .reduce((sum, c) => sum + c.saldo_pendiente, 0)
  
  const totalCreditos = creditosFiltrados.reduce((sum, c) => sum + c.monto_total, 0)
  const totalPagado = creditosFiltrados.reduce((sum, c) => sum + c.monto_pagado, 0)

  // Abrir detalle de crédito
  const abrirDetalle = (credito: Credito) => {
    setCreditoSeleccionado(credito)
    cargarPagos(credito.id)
  }

  // Abrir modal de nuevo pago
  const abrirNuevoPago = () => {
    if (!cajaAbierta) {
      setError('Debe abrir la caja para registrar pagos')
      return
    }
    setMontoPago('')
    setMetodoPago('efectivo')
    setNotasPago('')
    setError('')
    setShowNuevoPago(true)
  }

  // Guardar pago
  const guardarPago = async () => {
    if (!usuario?.id || !cajaId || !creditoSeleccionado) return

    const monto = parseFloat(montoPago) || 0
    if (monto <= 0) {
      setError('Ingrese un monto válido')
      return
    }

    if (monto > creditoSeleccionado.saldo_pendiente) {
      setError(`El monto no puede ser mayor al saldo pendiente (${formatCurrency(creditoSeleccionado.saldo_pendiente)})`)
      return
    }

    setGuardando(true)
    setError('')

    try {
      // Registrar pago
      const { data: pago, error: pagoError } = await supabase
        .from('pagos_credito')
        .insert({
          credito_id: creditoSeleccionado.id,
          usuario_id: usuario.id,
          caja_id: cajaId,
          monto,
          metodo_pago: metodoPago,
          notas: notasPago.trim() || null
        })
        .select()
        .single()

      if (pagoError) throw pagoError

      // Registrar movimiento en caja
      await supabase.from('movimientos_caja').insert({
        caja_id: cajaId,
        tipo: 'ingreso',
        concepto: `Pago crédito - Venta #${creditoSeleccionado.numero_venta} - ${creditoSeleccionado.cliente_nombre}`,
        referencia_id: pago.id,
        referencia_tipo: 'pago_credito',
        monto,
        metodo_pago: metodoPago
      })

      setShowNuevoPago(false)
      setShowExito(true)
      setTimeout(() => setShowExito(false), 2000)

      // Recargar datos
      await loadData()
      
      // Actualizar crédito seleccionado
      const nuevoSaldo = creditoSeleccionado.saldo_pendiente - monto
      const nuevoPagado = creditoSeleccionado.monto_pagado + monto
      setCreditoSeleccionado({
        ...creditoSeleccionado,
        saldo_pendiente: nuevoSaldo,
        monto_pagado: nuevoPagado,
        estado: nuevoSaldo <= 0 ? 'pagado' : 'pendiente'
      })
      
      // Recargar pagos
      cargarPagos(creditoSeleccionado.id)

    } catch (err) {
      console.error('Error guardando pago:', err)
      setError('Error al registrar el pago')
    } finally {
      setGuardando(false)
    }
  }

  // Exportar a Excel
  const exportarExcel = () => {
    if (creditosFiltrados.length === 0) return

    const datosExcel = creditosFiltrados.map(credito => ({
      'Venta #': credito.numero_venta,
      'Cliente': credito.cliente_nombre,
      'Teléfono': credito.cliente_telefono || '',
      'Monto Total': credito.monto_total,
      'Pagado': credito.monto_pagado,
      'Saldo Pendiente': credito.saldo_pendiente,
      'Estado': credito.estado === 'pendiente' ? 'Pendiente' : credito.estado === 'pagado' ? 'Pagado' : 'Vencido',
      'Fecha Crédito': formatDateTime(credito.created_at),
      'Fecha Vencimiento': credito.fecha_vencimiento ? formatDate(credito.fecha_vencimiento) : ''
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(datosExcel)
    XLSX.utils.book_append_sheet(wb, ws, 'Créditos')
    XLSX.writeFile(wb, `Creditos_${filtroEstado}.xlsx`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando créditos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24 max-w-4xl mx-auto">
      {/* Mensaje de éxito */}
      {showExito && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full animate-bounce-in">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Pago Registrado!</h2>
            <p className="text-emerald-600 text-lg font-medium">El pago se guardó correctamente</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Créditos</h1>
          <p className="text-gray-500 text-sm">{creditosFiltrados.length} créditos</p>
        </div>
        <button
          onClick={exportarExcel}
          disabled={creditosFiltrados.length === 0}
          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 self-end"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>
      </div>

      {!cajaAbierta && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          La caja está cerrada. Debe abrirla para registrar pagos.
        </div>
      )}

      {/* Filtros de estado */}
      <div className="flex gap-2 mb-4">
        {(['pendiente', 'pagado', 'todos'] as const).map(estado => (
          <button
            key={estado}
            onClick={() => setFiltroEstado(estado)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${
              filtroEstado === estado
                ? estado === 'pendiente' ? 'bg-amber-500 text-white'
                : estado === 'pagado' ? 'bg-emerald-500 text-white'
                : 'bg-gray-700 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {estado === 'pendiente' ? 'Pendientes' : estado === 'pagado' ? 'Pagados' : 'Todos'}
          </button>
        ))}
      </div>

      {/* Filtro por cliente */}
      <div className="mb-4">
        <select
          value={filtroCliente}
          onChange={e => setFiltroCliente(e.target.value)}
          className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-white text-sm"
        >
          <option value="">Todos los clientes</option>
          {clientes.map(cli => (
            <option key={cli.id} value={cli.id}>{cli.nombre}</option>
          ))}
        </select>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-amber-50 rounded-xl p-3 text-center">
          <p className="text-amber-600 font-bold text-lg">{formatCurrency(totalPendiente)}</p>
          <p className="text-amber-700 text-xs">Por Cobrar</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-3 text-center">
          <p className="text-emerald-600 font-bold text-lg">{formatCurrency(totalPagado)}</p>
          <p className="text-emerald-700 text-xs">Cobrado</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <p className="text-blue-600 font-bold text-lg">{formatCurrency(totalCreditos)}</p>
          <p className="text-blue-700 text-xs">Total Créditos</p>
        </div>
      </div>

      {/* Lista de créditos */}
      {creditosFiltrados.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No hay créditos</h3>
          <p className="text-gray-500">No se encontraron créditos con los filtros seleccionados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {creditosFiltrados.map(credito => (
            <div
              key={credito.id}
              onClick={() => abrirDetalle(credito)}
              className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow ${
                credito.estado === 'pagado' ? 'border-emerald-200' : 'border-gray-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    credito.estado === 'pagado' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{credito.cliente_nombre}</p>
                    <p className="text-gray-500 text-sm">Venta #{credito.numero_venta}</p>
                    <p className="text-gray-400 text-xs">{formatDateTime(credito.created_at)}</p>
                  </div>
                </div>
                <div className="text-right">
                  {credito.estado === 'pagado' ? (
                    <p className="font-bold text-emerald-600">{formatCurrency(credito.monto_total)}</p>
                  ) : (
                    <>
                      <p className="font-bold text-amber-600">{formatCurrency(credito.saldo_pendiente)}</p>
                      <p className="text-xs text-gray-400">de {formatCurrency(credito.monto_total)}</p>
                    </>
                  )}
                  <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
                    credito.estado === 'pagado' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {credito.estado === 'pagado' ? 'Pagado' : 'Pendiente'}
                  </span>
                </div>
              </div>
              {/* Barra de progreso */}
              {credito.estado === 'pendiente' && (
                <div className="mt-3">
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div 
                      className="h-2 bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${(credito.monto_pagado / credito.monto_total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {Math.round((credito.monto_pagado / credito.monto_total) * 100)}% pagado
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal detalle crédito */}
      {creditoSeleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Crédito - Venta #{creditoSeleccionado.numero_venta}</h2>
                  <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
                    creditoSeleccionado.estado === 'pagado' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {creditoSeleccionado.estado === 'pagado' ? 'Pagado' : 'Pendiente'}
                  </span>
                </div>
                <button onClick={() => setCreditoSeleccionado(null)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Info del cliente */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{creditoSeleccionado.cliente_nombre}</p>
                  {creditoSeleccionado.cliente_telefono && (
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {creditoSeleccionado.cliente_telefono}
                    </p>
                  )}
                </div>
              </div>

              {/* Montos */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-blue-50 rounded-xl">
                  <p className="text-blue-600 font-bold">{formatCurrency(creditoSeleccionado.monto_total)}</p>
                  <p className="text-blue-700 text-xs">Total</p>
                </div>
                <div className="text-center p-3 bg-emerald-50 rounded-xl">
                  <p className="text-emerald-600 font-bold">{formatCurrency(creditoSeleccionado.monto_pagado)}</p>
                  <p className="text-emerald-700 text-xs">Pagado</p>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-xl">
                  <p className="text-amber-600 font-bold">{formatCurrency(creditoSeleccionado.saldo_pendiente)}</p>
                  <p className="text-amber-700 text-xs">Pendiente</p>
                </div>
              </div>

              {/* Barra de progreso */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Progreso</span>
                  <span className="font-medium">{Math.round((creditoSeleccionado.monto_pagado / creditoSeleccionado.monto_total) * 100)}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full">
                  <div 
                    className="h-3 bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${(creditoSeleccionado.monto_pagado / creditoSeleccionado.monto_total) * 100}%` }}
                  />
                </div>
              </div>

              {/* Info adicional */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Fecha del crédito</span>
                  <p className="font-medium">{formatDateTime(creditoSeleccionado.created_at)}</p>
                </div>
                {creditoSeleccionado.fecha_vencimiento && (
                  <div>
                    <span className="text-gray-500">Fecha vencimiento</span>
                    <p className="font-medium">{formatDate(creditoSeleccionado.fecha_vencimiento)}</p>
                  </div>
                )}
              </div>

              {/* Historial de pagos */}
              <div className="border-t border-gray-100 pt-4">
                <h3 className="font-medium text-gray-900 mb-3">Historial de pagos</h3>
                {loadingPagos ? (
                  <div className="text-center py-4">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </div>
                ) : pagosCredito.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No hay pagos registrados</p>
                ) : (
                  <div className="space-y-2">
                    {pagosCredito.map(pago => (
                      <div key={pago.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-emerald-600">{formatCurrency(pago.monto)}</p>
                          <p className="text-xs text-gray-500">{formatDateTime(pago.created_at)}</p>
                          <p className="text-xs text-gray-400">{pago.usuario_nombre}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 ${
                          pago.metodo_pago === 'efectivo' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {pago.metodo_pago === 'efectivo' ? (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              Efectivo
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                              QR
                            </>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Botón registrar pago */}
              {creditoSeleccionado.estado === 'pendiente' && (
                <button
                  onClick={abrirNuevoPago}
                  disabled={!cajaAbierta}
                  className="w-full py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Registrar Pago
                </button>
              )}
            </div>

            <div className="p-6 border-t border-gray-100">
              <button
                onClick={() => setCreditoSeleccionado(null)}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nuevo pago */}
      {showNuevoPago && creditoSeleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Registrar Pago</h2>
                <button onClick={() => setShowNuevoPago(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="p-3 bg-amber-50 rounded-xl text-center">
                <p className="text-amber-700 text-sm">Saldo pendiente</p>
                <p className="text-amber-600 font-bold text-2xl">{formatCurrency(creditoSeleccionado.saldo_pendiente)}</p>
              </div>

              {/* Monto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto del pago (Bs.) *</label>
                <input
                  type="number"
                  value={montoPago}
                  onChange={e => setMontoPago(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg font-medium text-center"
                  step="0.01"
                  min="0"
                  max={creditoSeleccionado.saldo_pendiente}
                />
                {/* Botón pago total */}
                <button
                  onClick={() => setMontoPago(creditoSeleccionado.saldo_pendiente.toString())}
                  className="w-full mt-2 py-2 text-sm text-emerald-600 hover:bg-emerald-50 rounded-lg"
                >
                  Pagar todo ({formatCurrency(creditoSeleccionado.saldo_pendiente)})
                </button>
              </div>

              {/* Método de pago */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Método de pago</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMetodoPago('efectivo')}
                    className={`py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
                      metodoPago === 'efectivo' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Efectivo
                  </button>
                  <button
                    onClick={() => setMetodoPago('qr')}
                    className={`py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
                      metodoPago === 'qr' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    QR
                  </button>
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <input
                  type="text"
                  value={notasPago}
                  onChange={e => setNotasPago(e.target.value)}
                  placeholder="Observaciones del pago..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowNuevoPago(false)}
                className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={guardarPago}
                disabled={guardando || !montoPago || parseFloat(montoPago) <= 0}
                className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-xl font-medium disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : 'Confirmar Pago'}
              </button>
            </div>
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