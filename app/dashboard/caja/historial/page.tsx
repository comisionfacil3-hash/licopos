// Path: app\dashboard\caja\historial\page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { formatCurrency } from '@/lib/utils/format'
import { formatDateTime, formatDate, formatTime } from '@/lib/utils/timezone'
import * as XLSX from 'xlsx'

interface MovimientoCaja {
  id: string
  caja_id: string
  tipo: 'ingreso' | 'egreso' | 'retiro' | 'apertura' | 'cierre'
  concepto: string
  monto: number
  metodo_pago: 'efectivo' | 'qr' | null
  created_at: string
}

interface CajaHistorial {
  id: string
  nombre: string
  monto_inicial: number
  monto_inicial_qr: number
  monto_final: number | null
  monto_final_qr: number | null
  fecha_apertura: string
  fecha_cierre: string | null
  estado: 'abierta' | 'cerrada'
  notas: string | null
  usuario_nombre: string
  movimientos: MovimientoCaja[]
  // Totales calculados
  total_ventas_efectivo: number
  total_ventas_qr: number
  total_gastos_efectivo: number
  total_gastos_qr: number
  total_retiros: number
}

export default function HistorialCajasPage() {
  const [cajas, setCajas] = useState<CajaHistorial[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroFecha, setFiltroFecha] = useState<'hoy' | 'semanal' | 'mensual'>('semanal')
  const [cajaSeleccionada, setCajaSeleccionada] = useState<CajaHistorial | null>(null)
  const [exportando, setExportando] = useState(false)

  const { usuario } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (usuario?.sucursal_id) {
      loadCajas()
    }
  }, [usuario?.sucursal_id, filtroFecha])

  const loadCajas = async () => {
    if (!usuario?.sucursal_id) return

    setLoading(true)
    try {
      const ahora = new Date()
      let fechaInicio: Date

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

      // Cargar cajas cerradas
      const { data: cajasData, error: cajasError } = await supabase
        .from('cajas')
        .select('*')
        .eq('sucursal_id', usuario.sucursal_id)
        .gte('fecha_apertura', fechaInicio.toISOString())
        .order('fecha_apertura', { ascending: false })

      if (cajasError) {
        console.error('Error cargando cajas:', cajasError)
        setCajas([])
        return
      }

      if (!cajasData || cajasData.length === 0) {
        setCajas([])
        return
      }

      // Obtener IDs de usuarios
      const usuarioIds = [...new Set(cajasData.map(c => c.usuario_id))]
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

      // Cargar movimientos de cada caja
      const cajasConMovimientos: CajaHistorial[] = []

      for (const caja of cajasData) {
        const { data: movimientosData } = await supabase
          .from('movimientos_caja')
          .select('*')
          .eq('caja_id', caja.id)
          .order('created_at', { ascending: true })

        const movimientos = movimientosData || []

        // Calcular totales
        let total_ventas_efectivo = 0
        let total_ventas_qr = 0
        let total_gastos_efectivo = 0
        let total_gastos_qr = 0
        let total_retiros = 0

        movimientos.forEach(mov => {
          if (mov.tipo === 'ingreso') {
            if (mov.metodo_pago === 'efectivo') total_ventas_efectivo += mov.monto
            else if (mov.metodo_pago === 'qr') total_ventas_qr += mov.monto
          } else if (mov.tipo === 'egreso') {
            if (mov.metodo_pago === 'efectivo') total_gastos_efectivo += mov.monto
            else if (mov.metodo_pago === 'qr') total_gastos_qr += mov.monto
          } else if (mov.tipo === 'retiro') {
            total_retiros += mov.monto
          }
        })

        cajasConMovimientos.push({
          id: caja.id,
          nombre: caja.nombre || 'Caja Principal',
          monto_inicial: caja.monto_inicial || 0,
          monto_inicial_qr: caja.monto_inicial_qr || 0,
          monto_final: caja.monto_final,
          monto_final_qr: caja.monto_final_qr,
          fecha_apertura: caja.fecha_apertura,
          fecha_cierre: caja.fecha_cierre,
          estado: caja.estado,
          notas: caja.notas,
          usuario_nombre: usuariosMap[caja.usuario_id] || 'Desconocido',
          movimientos,
          total_ventas_efectivo,
          total_ventas_qr,
          total_gastos_efectivo,
          total_gastos_qr,
          total_retiros
        })
      }

      setCajas(cajasConMovimientos)
    } catch (err) {
      console.error('Error:', err)
      setCajas([])
    } finally {
      setLoading(false)
    }
  }

  const getMetodoPagoIcon = (metodo: string | null) => {
    switch (metodo) {
      case 'efectivo': return '💵'
      case 'qr': return '📱'
      default: return '💰'
    }
  }

  const getTipoMovColor = (tipo: string) => {
    switch (tipo) {
      case 'ingreso': return 'text-emerald-600'
      case 'apertura': return 'text-blue-600'
      case 'egreso': return 'text-red-600'
      case 'retiro': return 'text-amber-600'
      case 'cierre': return 'text-purple-600'
      default: return 'text-gray-600'
    }
  }

  const getTipoMovBg = (tipo: string) => {
    switch (tipo) {
      case 'ingreso': return 'bg-emerald-50'
      case 'apertura': return 'bg-blue-50'
      case 'egreso': return 'bg-red-50'
      case 'retiro': return 'bg-amber-50'
      case 'cierre': return 'bg-purple-50'
      default: return 'bg-gray-50'
    }
  }

  // Exportar historial a Excel
  // Calcular diferencias entre esperado y contado
  const calcularDiferencias = (caja: CajaHistorial) => {
    if (caja.monto_final === null && caja.monto_final_qr === null) {
      return { efectivo: 0, qr: 0, hayDiferencia: false }
    }

    const esperadoEfectivo = caja.monto_inicial + caja.total_ventas_efectivo - caja.total_gastos_efectivo - caja.total_retiros
    const esperadoQR = caja.monto_inicial_qr + caja.total_ventas_qr - caja.total_gastos_qr
    
    const diferenciaEfectivo = caja.monto_final !== null ? (caja.monto_final - esperadoEfectivo) : 0
    const diferenciaQR = caja.monto_final_qr !== null ? (caja.monto_final_qr - esperadoQR) : 0
    
    const hayDiferencia = Math.abs(diferenciaEfectivo) > 0.01 || Math.abs(diferenciaQR) > 0.01
    
    return { efectivo: diferenciaEfectivo, qr: diferenciaQR, hayDiferencia }
  }

  const exportarExcel = () => {
    if (cajas.length === 0) return
    
    setExportando(true)
    
    try {
      const wb = XLSX.utils.book_new()

      // Hoja 1: Resumen de Cajas
      const resumenCajas = cajas.map(caja => ({
        'Fecha Apertura': formatDateTime(caja.fecha_apertura),
        'Fecha Cierre': caja.fecha_cierre ? formatDateTime(caja.fecha_cierre) : 'Abierta',
        'Usuario': caja.usuario_nombre,
        'Estado': caja.estado === 'abierta' ? 'ABIERTA' : 'CERRADA',
        'Monto Inicial Efectivo': caja.monto_inicial,
        'Monto Inicial QR': caja.monto_inicial_qr,
        'Ventas Efectivo': caja.total_ventas_efectivo,
        'Ventas QR': caja.total_ventas_qr,
        'Gastos Efectivo': caja.total_gastos_efectivo,
        'Gastos QR': caja.total_gastos_qr,
        'Retiros': caja.total_retiros,
        'Monto Final Efectivo': caja.monto_final ?? 'N/A',
        'Monto Final QR': caja.monto_final_qr ?? 'N/A',
        'Diferencia Efectivo': caja.monto_final !== null 
          ? caja.monto_final - (caja.monto_inicial + caja.total_ventas_efectivo - caja.total_gastos_efectivo - caja.total_retiros)
          : 'N/A',
        'Diferencia QR': caja.monto_final_qr !== null
          ? caja.monto_final_qr - (caja.monto_inicial_qr + caja.total_ventas_qr - caja.total_gastos_qr)
          : 'N/A',
        'Notas': caja.notas || ''
      }))

      const wsResumen = XLSX.utils.json_to_sheet(resumenCajas)
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Cajas')

      // Hoja 2: Todos los Movimientos
      const todosMovimientos: any[] = []
      cajas.forEach(caja => {
        caja.movimientos.forEach(mov => {
          todosMovimientos.push({
            'Fecha Caja': formatDate(caja.fecha_apertura),
            'Hora Movimiento': formatTime(mov.created_at),
            'Fecha/Hora Completa': formatDateTime(mov.created_at),
            'Tipo': mov.tipo.toUpperCase(),
            'Concepto': mov.concepto,
            'Método Pago': mov.metodo_pago === 'efectivo' ? 'Efectivo' : mov.metodo_pago === 'qr' ? 'QR' : 'N/A',
            'Monto': mov.monto,
            'Es Ingreso': mov.tipo === 'ingreso' || mov.tipo === 'apertura' ? 'SÍ' : 'NO',
            'Usuario Caja': caja.usuario_nombre
          })
        })
      })

      const wsMovimientos = XLSX.utils.json_to_sheet(todosMovimientos)
      XLSX.utils.book_append_sheet(wb, wsMovimientos, 'Todos los Movimientos')

      // Hoja 3: Totales Generales
      const totalesGenerales = [
        { Concepto: 'Período', Valor: filtroFecha === 'hoy' ? 'Hoy' : filtroFecha === 'semanal' ? 'Última semana' : 'Este mes' },
        { Concepto: 'Total Cajas', Valor: cajas.length },
        { Concepto: 'Cajas Cerradas', Valor: cajas.filter(c => c.estado === 'cerrada').length },
        { Concepto: 'Cajas Abiertas', Valor: cajas.filter(c => c.estado === 'abierta').length },
        { Concepto: '---', Valor: '---' },
        { Concepto: 'Total Ventas Efectivo', Valor: formatCurrency(cajas.reduce((sum, c) => sum + c.total_ventas_efectivo, 0)) },
        { Concepto: 'Total Ventas QR', Valor: formatCurrency(cajas.reduce((sum, c) => sum + c.total_ventas_qr, 0)) },
        { Concepto: 'Total Ventas General', Valor: formatCurrency(cajas.reduce((sum, c) => sum + c.total_ventas_efectivo + c.total_ventas_qr, 0)) },
        { Concepto: '---', Valor: '---' },
        { Concepto: 'Total Gastos Efectivo', Valor: formatCurrency(cajas.reduce((sum, c) => sum + c.total_gastos_efectivo, 0)) },
        { Concepto: 'Total Gastos QR', Valor: formatCurrency(cajas.reduce((sum, c) => sum + c.total_gastos_qr, 0)) },
        { Concepto: 'Total Retiros', Valor: formatCurrency(cajas.reduce((sum, c) => sum + c.total_retiros, 0)) },
      ]

      const wsTotales = XLSX.utils.json_to_sheet(totalesGenerales)
      XLSX.utils.book_append_sheet(wb, wsTotales, 'Totales Generales')

      const fileName = `Historial_Cajas_${filtroFecha}.xlsx`
      XLSX.writeFile(wb, fileName)
      
    } catch (err) {
      console.error('Error exportando:', err)
      alert('Error al exportar el archivo')
    } finally {
      setExportando(false)
    }
  }

  // Exportar una caja individual
  const exportarCajaIndividual = (caja: CajaHistorial) => {
    try {
      const wb = XLSX.utils.book_new()

      // Info de la caja
      const infoCaja = [
        { Campo: 'Fecha Apertura', Valor: formatDateTime(caja.fecha_apertura) },
        { Campo: 'Fecha Cierre', Valor: caja.fecha_cierre ? formatDateTime(caja.fecha_cierre) : 'ABIERTA' },
        { Campo: 'Usuario', Valor: caja.usuario_nombre },
        { Campo: 'Estado', Valor: caja.estado.toUpperCase() },
        { Campo: '---', Valor: '---' },
        { Campo: 'Monto Inicial Efectivo', Valor: formatCurrency(caja.monto_inicial) },
        { Campo: 'Monto Inicial QR', Valor: formatCurrency(caja.monto_inicial_qr) },
        { Campo: '---', Valor: '---' },
        { Campo: 'Ventas Efectivo', Valor: formatCurrency(caja.total_ventas_efectivo) },
        { Campo: 'Ventas QR', Valor: formatCurrency(caja.total_ventas_qr) },
        { Campo: 'Gastos Efectivo', Valor: formatCurrency(caja.total_gastos_efectivo) },
        { Campo: 'Gastos QR', Valor: formatCurrency(caja.total_gastos_qr) },
        { Campo: 'Retiros', Valor: formatCurrency(caja.total_retiros) },
        { Campo: '---', Valor: '---' },
        { Campo: 'Esperado Efectivo', Valor: formatCurrency(caja.monto_inicial + caja.total_ventas_efectivo - caja.total_gastos_efectivo - caja.total_retiros) },
        { Campo: 'Esperado QR', Valor: formatCurrency(caja.monto_inicial_qr + caja.total_ventas_qr - caja.total_gastos_qr) },
        { Campo: 'Monto Final Efectivo', Valor: caja.monto_final !== null ? formatCurrency(caja.monto_final) : 'N/A' },
        { Campo: 'Monto Final QR', Valor: caja.monto_final_qr !== null ? formatCurrency(caja.monto_final_qr) : 'N/A' },
        { Campo: '---', Valor: '---' },
        { Campo: 'Notas', Valor: caja.notas || '' },
      ]

      const wsInfo = XLSX.utils.json_to_sheet(infoCaja)
      XLSX.utils.book_append_sheet(wb, wsInfo, 'Resumen')

      // Movimientos
      const movimientos = caja.movimientos.map(mov => ({
        'Hora': formatTime(mov.created_at),
        'Tipo': mov.tipo.toUpperCase(),
        'Concepto': mov.concepto,
        'Método': mov.metodo_pago === 'efectivo' ? 'Efectivo' : mov.metodo_pago === 'qr' ? 'QR' : 'N/A',
        'Monto': mov.monto,
        'Signo': mov.tipo === 'ingreso' || mov.tipo === 'apertura' ? '+' : '-'
      }))

      const wsMovimientos = XLSX.utils.json_to_sheet(movimientos)
      XLSX.utils.book_append_sheet(wb, wsMovimientos, 'Movimientos')

      const fechaArchivo = formatDate(caja.fecha_apertura).replace(/\//g, '-')
      const fileName = `Caja_${fechaArchivo}.xlsx`
      XLSX.writeFile(wb, fileName)
      
    } catch (err) {
      console.error('Error exportando:', err)
      alert('Error al exportar')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando historial...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historial de Cajas</h1>
          <p className="text-gray-500 text-sm">{cajas.length} cajas en el período</p>
        </div>
        <button
          onClick={exportarExcel}
          disabled={exportando || cajas.length === 0}
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 font-medium flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {exportando ? 'Exportando...' : 'Exportar Todo'}
        </button>
      </div>

      {/* Filtros de fecha */}
      <div className="flex gap-2 mb-6">
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

      {/* Totales del período */}
      {cajas.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <p className="text-emerald-600 font-bold text-lg">
              {formatCurrency(cajas.reduce((sum, c) => sum + c.total_ventas_efectivo + c.total_ventas_qr, 0))}
            </p>
            <p className="text-emerald-700 text-xs">Total Ventas</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-3 text-center">
            <p className="text-amber-600 font-bold text-lg">
              {formatCurrency(cajas.reduce((sum, c) => sum + c.total_ventas_efectivo, 0))}
            </p>
            <p className="text-amber-700 text-xs">💵 Efectivo</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-3 text-center">
            <p className="text-purple-600 font-bold text-lg">
              {formatCurrency(cajas.reduce((sum, c) => sum + c.total_ventas_qr, 0))}
            </p>
            <p className="text-purple-700 text-xs">📱 QR</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <p className="text-red-600 font-bold text-lg">
              {formatCurrency(cajas.reduce((sum, c) => sum + c.total_gastos_efectivo + c.total_gastos_qr + c.total_retiros, 0))}
            </p>
            <p className="text-red-700 text-xs">Egresos</p>
          </div>
        </div>
      )}

      {cajas.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No hay cajas</h3>
          <p className="text-gray-500">No se encontraron cajas en este período</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cajas.map(caja => (
            <div
              key={caja.id}
              onClick={() => setCajaSeleccionada(caja)}
              className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow ${
                caja.estado === 'abierta' ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-100'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{formatDate(caja.fecha_apertura)}</span>
                    {caja.estado === 'abierta' && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full animate-pulse">
                        Abierta
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm">👤 {caja.usuario_nombre}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">
                    {formatTime(caja.fecha_apertura)} - {caja.fecha_cierre ? formatTime(caja.fecha_cierre) : 'Ahora'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-gray-500 text-xs">💵 Efectivo</p>
                  <p className="font-medium text-gray-900">{formatCurrency(caja.total_ventas_efectivo)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-gray-500 text-xs">📱 QR</p>
                  <p className="font-medium text-gray-900">{formatCurrency(caja.total_ventas_qr)}</p>
                </div>
              </div>

              <div className="mt-2 flex justify-between items-center text-xs">
                <span className="text-gray-400">{caja.movimientos.length} movimientos</span>
                {(() => {
                  const diff = calcularDiferencias(caja)
                  if (!diff.hayDiferencia) {
                    return <span className="text-gray-400">Tap para ver detalle →</span>
                  }
                  
                  const totalDiferencia = diff.efectivo + diff.qr
                  const faltaDinero = totalDiferencia < 0
                  
                  return (
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                      faltaDinero 
                        ? 'bg-red-100 text-red-700' 
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {faltaDinero ? '⚠ ' : '⚡ '}
                      {formatCurrency(Math.abs(totalDiferencia))}
                    </span>
                  )
                })()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de detalle de caja */}
      {cajaSeleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Caja {formatDate(cajaSeleccionada.fecha_apertura)}
                  </h2>
                  {cajaSeleccionada.estado === 'abierta' && (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">Abierta</span>
                  )}
                </div>
                <button
                  onClick={() => setCajaSeleccionada(null)}
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
                  <span className="text-gray-500">Apertura</span>
                  <p className="font-medium">{formatDateTime(cajaSeleccionada.fecha_apertura)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Cierre</span>
                  <p className="font-medium">
                    {cajaSeleccionada.fecha_cierre ? formatDateTime(cajaSeleccionada.fecha_cierre) : 'Aún abierta'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Usuario</span>
                  <p className="font-medium">{cajaSeleccionada.usuario_nombre}</p>
                </div>
                <div>
                  <span className="text-gray-500">Movimientos</span>
                  <p className="font-medium">{cajaSeleccionada.movimientos.length}</p>
                </div>
              </div>

              {/* Resumen financiero */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <h3 className="font-medium text-gray-900 mb-2">Resumen Financiero</h3>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs mb-1">💵 EFECTIVO</p>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Inicial:</span>
                        <span>{formatCurrency(cajaSeleccionada.monto_inicial)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-600">
                        <span>+ Ventas:</span>
                        <span>{formatCurrency(cajaSeleccionada.total_ventas_efectivo)}</span>
                      </div>
                      <div className="flex justify-between text-red-600">
                        <span>- Gastos:</span>
                        <span>{formatCurrency(cajaSeleccionada.total_gastos_efectivo)}</span>
                      </div>
                      <div className="flex justify-between text-amber-600">
                        <span>- Retiros:</span>
                        <span>{formatCurrency(cajaSeleccionada.total_retiros)}</span>
                      </div>
                      <div className="flex justify-between font-medium border-t pt-1">
                        <span>Esperado:</span>
                        <span>{formatCurrency(
                          cajaSeleccionada.monto_inicial + 
                          cajaSeleccionada.total_ventas_efectivo - 
                          cajaSeleccionada.total_gastos_efectivo - 
                          cajaSeleccionada.total_retiros
                        )}</span>
                      </div>
                      {cajaSeleccionada.monto_final !== null && (
                        <div className="flex justify-between font-medium text-blue-600">
                          <span>Contado:</span>
                          <span>{formatCurrency(cajaSeleccionada.monto_final)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-gray-500 text-xs mb-1">📱 QR</p>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Inicial:</span>
                        <span>{formatCurrency(cajaSeleccionada.monto_inicial_qr)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-600">
                        <span>+ Ventas:</span>
                        <span>{formatCurrency(cajaSeleccionada.total_ventas_qr)}</span>
                      </div>
                      <div className="flex justify-between text-red-600">
                        <span>- Gastos:</span>
                        <span>{formatCurrency(cajaSeleccionada.total_gastos_qr)}</span>
                      </div>
                      <div className="flex justify-between font-medium border-t pt-1">
                        <span>Esperado:</span>
                        <span>{formatCurrency(
                          cajaSeleccionada.monto_inicial_qr + 
                          cajaSeleccionada.total_ventas_qr - 
                          cajaSeleccionada.total_gastos_qr
                        )}</span>
                      </div>
                      {cajaSeleccionada.monto_final_qr !== null && (
                        <div className="flex justify-between font-medium text-blue-600">
                          <span>Contado:</span>
                          <span>{formatCurrency(cajaSeleccionada.monto_final_qr)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Diferencias (sutil) */}
              {(() => {
                const diff = calcularDiferencias(cajaSeleccionada)
                if (!diff.hayDiferencia) return null
                
                const totalDiferencia = diff.efectivo + diff.qr
                const faltaDinero = totalDiferencia < 0
                
                return (
                  <div className={`p-3 rounded-lg border ${
                    faltaDinero 
                      ? 'bg-red-50/50 border-red-200' 
                      : 'bg-amber-50/50 border-amber-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Diferencias al cierre</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        faltaDinero 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {faltaDinero ? 'Faltante' : 'Sobrante'}
                      </span>
                    </div>
                    
                    <div className="space-y-1.5 text-sm">
                      {Math.abs(diff.efectivo) > 0.01 && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">💵 Efectivo:</span>
                          <span className={`font-semibold ${
                            diff.efectivo < 0 ? 'text-red-600' : 'text-amber-600'
                          }`}>
                            {diff.efectivo > 0 ? '+' : ''}{formatCurrency(diff.efectivo)}
                          </span>
                        </div>
                      )}
                      {Math.abs(diff.qr) > 0.01 && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">📱 QR:</span>
                          <span className={`font-semibold ${
                            diff.qr < 0 ? 'text-red-600' : 'text-amber-600'
                          }`}>
                            {diff.qr > 0 ? '+' : ''}{formatCurrency(diff.qr)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1.5 border-t border-gray-200">
                        <span className="font-medium text-gray-900">Total:</span>
                        <span className={`font-bold ${
                          totalDiferencia < 0 ? 'text-red-600' : 'text-amber-600'
                        }`}>
                          {totalDiferencia > 0 ? '+' : ''}{formatCurrency(totalDiferencia)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Movimientos */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">
                  Movimientos ({cajaSeleccionada.movimientos.length})
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {cajaSeleccionada.movimientos.map(mov => (
                    <div 
                      key={mov.id} 
                      className={`flex items-center justify-between p-2 rounded-lg ${getTipoMovBg(mov.tipo)}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${getTipoMovColor(mov.tipo)}`}>
                            {mov.tipo.toUpperCase()}
                          </span>
                          {mov.metodo_pago && (
                            <span className="text-xs">{getMetodoPagoIcon(mov.metodo_pago)}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700">{mov.concepto}</p>
                        <p className="text-xs text-gray-400">{formatTime(mov.created_at)}</p>
                      </div>
                      <span className={`font-medium ${
                        mov.tipo === 'ingreso' || mov.tipo === 'apertura' 
                          ? 'text-emerald-600' 
                          : 'text-red-600'
                      }`}>
                        {mov.tipo === 'egreso' || mov.tipo === 'retiro' ? '-' : '+'}
                        {formatCurrency(mov.monto)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notas */}
              {cajaSeleccionada.notas && (
                <div className="p-3 bg-amber-50 rounded-lg">
                  <p className="text-sm text-amber-700">
                    <strong>Notas:</strong> {cajaSeleccionada.notas}
                  </p>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => exportarCajaIndividual(cajaSeleccionada)}
                className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Exportar
              </button>
              <button
                onClick={() => setCajaSeleccionada(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200"
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