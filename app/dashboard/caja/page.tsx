'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { formatCurrency } from '@/lib/utils/format'
import { formatDateTime, formatTime } from '@/lib/utils/timezone'

interface Caja {
  id: string
  sucursal_id: string
  usuario_id: string
  nombre: string
  monto_inicial: number
  monto_inicial_qr: number
  monto_final: number | null
  monto_final_qr: number | null
  fecha_apertura: string
  fecha_cierre: string | null
  estado: 'abierta' | 'cerrada'
  notas: string | null
}

interface MovimientoCaja {
  id: string
  caja_id: string
  tipo: 'ingreso' | 'egreso' | 'retiro' | 'apertura' | 'cierre'
  concepto: string
  monto: number
  metodo_pago: 'efectivo' | 'qr' | null
  created_at: string
}

interface ResumenCaja {
  monto_inicial: number
  monto_inicial_qr: number
  ventas_efectivo: number
  ventas_qr: number
  gastos_efectivo: number
  gastos_qr: number
  retiros: number
  total_efectivo: number
  total_qr: number
}

export default function CajaPage() {
  const [cajaAbierta, setCajaAbierta] = useState<Caja | null>(null)
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([])
  const [resumen, setResumen] = useState<ResumenCaja | null>(null)
  const [ultimoCierreEfectivo, setUltimoCierreEfectivo] = useState<number>(0)
  const [ultimoCierreQR, setUltimoCierreQR] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  
  const [showAbrirModal, setShowAbrirModal] = useState(false)
  const [showCerrarModal, setShowCerrarModal] = useState(false)
  const [showRetiroModal, setShowRetiroModal] = useState(false)
  const [showExito, setShowExito] = useState(false)
  const [mensajeExito, setMensajeExito] = useState('')
  
  const [montoInicialEfectivo, setMontoInicialEfectivo] = useState('')
  const [montoInicialQR, setMontoInicialQR] = useState('')
  const [montoFinalEfectivo, setMontoFinalEfectivo] = useState('')
  const [montoFinalQR, setMontoFinalQR] = useState('')
  const [montoRetiro, setMontoRetiro] = useState('')
  const [conceptoRetiro, setConceptoRetiro] = useState('')
  const [notasCierre, setNotasCierre] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { usuario } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (usuario?.sucursal_id) {
      loadCaja()
      loadUltimoCierre()
    }
  }, [usuario?.sucursal_id])

  const loadCaja = async () => {
    if (!usuario?.sucursal_id) return

    setLoading(true)
    try {
      // Buscar caja abierta
      const { data: caja } = await supabase
        .from('cajas')
        .select('*')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('estado', 'abierta')
        .maybeSingle()

      setCajaAbierta(caja)

      if (caja) {
        // Cargar movimientos
        const { data: movs } = await supabase
          .from('movimientos_caja')
          .select('*')
          .eq('caja_id', caja.id)
          .order('created_at', { ascending: false })

        setMovimientos(movs || [])
        calcularResumen(caja, movs || [])
      } else {
        setMovimientos([])
        setResumen(null)
      }
    } catch (err) {
      console.error('Error cargando caja:', err)
    } finally {
      setLoading(false)
    }
  }

  const calcularResumen = (caja: Caja, movs: MovimientoCaja[]) => {
    const res: ResumenCaja = {
      monto_inicial: caja.monto_inicial || 0,
      monto_inicial_qr: caja.monto_inicial_qr || 0,
      ventas_efectivo: 0,
      ventas_qr: 0,
      gastos_efectivo: 0,
      gastos_qr: 0,
      retiros: 0,
      total_efectivo: caja.monto_inicial || 0,
      total_qr: caja.monto_inicial_qr || 0
    }

    movs.forEach(mov => {
      if (mov.tipo === 'ingreso') {
        if (mov.metodo_pago === 'efectivo') {
          res.ventas_efectivo += mov.monto
          res.total_efectivo += mov.monto
        } else if (mov.metodo_pago === 'qr') {
          res.ventas_qr += mov.monto
          res.total_qr += mov.monto
        }
      } else if (mov.tipo === 'egreso') {
        if (mov.metodo_pago === 'efectivo') {
          res.gastos_efectivo += mov.monto
          res.total_efectivo -= mov.monto
        } else if (mov.metodo_pago === 'qr') {
          res.gastos_qr += mov.monto
          res.total_qr -= mov.monto
        }
      } else if (mov.tipo === 'retiro') {
        res.retiros += mov.monto
        res.total_efectivo -= mov.monto
      }
    })

    setResumen(res)
  }

  const loadUltimoCierre = async () => {
    if (!usuario?.sucursal_id) return

    const { data } = await supabase
      .from('cajas')
      .select('monto_final, monto_final_qr')
      .eq('sucursal_id', usuario.sucursal_id)
      .eq('estado', 'cerrada')
      .order('fecha_cierre', { ascending: false })
      .limit(1)
      .maybeSingle()

    setUltimoCierreEfectivo(data?.monto_final || 0)
    setUltimoCierreQR(data?.monto_final_qr || 0)
  }

  const mostrarExito = (mensaje: string) => {
    setMensajeExito(mensaje)
    setShowExito(true)
    setTimeout(() => setShowExito(false), 2500)
  }

  const handleAbrirCaja = async () => {
    if (!usuario?.sucursal_id || !usuario?.id) return
    
    const montoEfectivo = parseFloat(montoInicialEfectivo) || 0
    const montoQR = parseFloat(montoInicialQR) || 0
    
    if (montoEfectivo < 0 || montoQR < 0) {
      setError('Los montos no pueden ser negativos')
      return
    }

    setSaving(true)
    setError('')
    
    try {
      const { data: nuevaCaja, error: cajaError } = await supabase
        .from('cajas')
        .insert({
          sucursal_id: usuario.sucursal_id,
          usuario_id: usuario.id,
          monto_inicial: montoEfectivo,
          monto_inicial_qr: montoQR,
          estado: 'abierta'
        })
        .select()
        .single()

      if (cajaError) throw cajaError

      // Registrar movimiento de apertura efectivo
      if (montoEfectivo > 0) {
        await supabase
          .from('movimientos_caja')
          .insert({
            caja_id: nuevaCaja.id,
            tipo: 'apertura',
            concepto: 'Apertura de caja - Efectivo',
            monto: montoEfectivo,
            metodo_pago: 'efectivo'
          })
      }

      // Registrar movimiento de apertura QR
      if (montoQR > 0) {
        await supabase
          .from('movimientos_caja')
          .insert({
            caja_id: nuevaCaja.id,
            tipo: 'apertura',
            concepto: 'Apertura de caja - QR',
            monto: montoQR,
            metodo_pago: 'qr'
          })
      }

      setShowAbrirModal(false)
      setMontoInicialEfectivo('')
      setMontoInicialQR('')
      mostrarExito('¡Caja abierta correctamente!')
      await loadCaja()
    } catch (err) {
      console.error('Error abriendo caja:', err)
      setError('Error al abrir la caja')
    } finally {
      setSaving(false)
    }
  }

  const handleCerrarCaja = async () => {
    if (!cajaAbierta) return
    
    const montoEfectivo = parseFloat(montoFinalEfectivo) || 0
    const montoQR = parseFloat(montoFinalQR) || 0
    
    if (montoEfectivo < 0 || montoQR < 0) {
      setError('Los montos no pueden ser negativos')
      return
    }

    setSaving(true)
    setError('')
    
    try {
      const { error: updateError } = await supabase
        .from('cajas')
        .update({
          monto_final: montoEfectivo,
          monto_final_qr: montoQR,
          fecha_cierre: new Date().toISOString(),
          estado: 'cerrada',
          notas: notasCierre || null
        })
        .eq('id', cajaAbierta.id)

      if (updateError) throw updateError

      // Registrar movimiento de cierre
      await supabase
        .from('movimientos_caja')
        .insert({
          caja_id: cajaAbierta.id,
          tipo: 'cierre',
          concepto: `Cierre de caja - Efectivo: ${formatCurrency(montoEfectivo)}, QR: ${formatCurrency(montoQR)}`,
          monto: montoEfectivo + montoQR,
          metodo_pago: 'efectivo'
        })

      setShowCerrarModal(false)
      setMontoFinalEfectivo('')
      setMontoFinalQR('')
      setNotasCierre('')
      mostrarExito('¡Caja cerrada correctamente!')
      await loadCaja()
    } catch (err) {
      console.error('Error cerrando caja:', err)
      setError('Error al cerrar la caja')
    } finally {
      setSaving(false)
    }
  }

  const handleRetiro = async () => {
    if (!cajaAbierta) return
    
    const monto = parseFloat(montoRetiro) || 0
    if (monto <= 0) {
      setError('El monto debe ser mayor a 0')
      return
    }
    if (!conceptoRetiro.trim()) {
      setError('Debe ingresar un concepto')
      return
    }

    if (resumen && monto > resumen.total_efectivo) {
      setError('No hay suficiente efectivo en caja')
      return
    }

    setSaving(true)
    setError('')
    
    try {
      const { error: insertError } = await supabase
        .from('movimientos_caja')
        .insert({
          caja_id: cajaAbierta.id,
          tipo: 'retiro',
          concepto: conceptoRetiro.trim(),
          monto: monto,
          metodo_pago: 'efectivo'
        })

      if (insertError) throw insertError

      setShowRetiroModal(false)
      setMontoRetiro('')
      setConceptoRetiro('')
      mostrarExito('¡Retiro registrado!')
      await loadCaja()
    } catch (err) {
      console.error('Error registrando retiro:', err)
      setError('Error al registrar el retiro')
    } finally {
      setSaving(false)
    }
  }

  const openAbrirModal = () => {
    setMontoInicialEfectivo(ultimoCierreEfectivo.toString())
    setMontoInicialQR(ultimoCierreQR.toString())
    setError('')
    setShowAbrirModal(true)
  }

  const openCerrarModal = () => {
    setMontoFinalEfectivo(resumen?.total_efectivo.toFixed(2) || '0')
    setMontoFinalQR(resumen?.total_qr.toFixed(2) || '0')
    setNotasCierre('')
    setError('')
    setShowCerrarModal(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando caja...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24 max-w-4xl mx-auto">
      {/* Modal Éxito */}
      {showExito && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full animate-bounce-in">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">{mensajeExito}</h2>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Caja</h1>
        <p className="text-gray-500 text-sm">
          {cajaAbierta ? 'Caja abierta' : 'Caja cerrada'}
        </p>
      </div>

      {!cajaAbierta ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Caja Cerrada</h3>
          <p className="text-gray-500 mb-1">
            {ultimoCierreEfectivo > 0 || ultimoCierreQR > 0 
              ? 'Último cierre:'
              : 'No hay registros de cierres anteriores'}
          </p>
          {(ultimoCierreEfectivo > 0 || ultimoCierreQR > 0) && (
            <div className="text-sm text-gray-600 mb-4">
              <p>💵 Efectivo: {formatCurrency(ultimoCierreEfectivo)}</p>
              <p>📱 QR: {formatCurrency(ultimoCierreQR)}</p>
            </div>
          )}
          <button
            onClick={openAbrirModal}
            className="px-6 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-medium"
          >
            Abrir Caja
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-800 font-medium">Caja Abierta</p>
                <p className="text-emerald-600 text-sm">
                  Desde {formatDateTime(cajaAbierta.fecha_apertura)}
                </p>
              </div>
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
            </div>
          </div>

          {resumen && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">💵</span>
                  <p className="text-gray-500 text-sm">Efectivo</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(resumen.total_efectivo)}
                </p>
                <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                  <p>Inicial: {formatCurrency(resumen.monto_inicial)}</p>
                  <p className="text-emerald-600">+ Ventas: {formatCurrency(resumen.ventas_efectivo)}</p>
                  <p className="text-red-600">- Gastos: {formatCurrency(resumen.gastos_efectivo)}</p>
                  <p className="text-amber-600">- Retiros: {formatCurrency(resumen.retiros)}</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">📱</span>
                  <p className="text-gray-500 text-sm">QR</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(resumen.total_qr)}
                </p>
                <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                  <p>Inicial: {formatCurrency(resumen.monto_inicial_qr)}</p>
                  <p className="text-emerald-600">+ Ventas: {formatCurrency(resumen.ventas_qr)}</p>
                  <p className="text-red-600">- Gastos: {formatCurrency(resumen.gastos_qr)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex gap-3">
            <button
              onClick={() => { setError(''); setShowRetiroModal(true) }}
              className="flex-1 px-4 py-3 bg-amber-50 text-amber-700 rounded-xl hover:bg-amber-100 transition-colors font-medium"
            >
              Retiro
            </button>
            <button
              onClick={openCerrarModal}
              className="flex-1 px-4 py-3 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-colors font-medium"
            >
              Cerrar Caja
            </button>
          </div>

          {movimientos.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h3 className="font-medium text-gray-900 mb-3">Movimientos recientes</h3>
              <div className="space-y-2">
                {movimientos.slice(0, 15).map(mov => (
                  <div key={mov.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-gray-900 text-sm">{mov.concepto}</p>
                        {mov.metodo_pago && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {mov.metodo_pago === 'efectivo' ? '💵' : '📱'} {mov.metodo_pago === 'efectivo' ? 'Efectivo' : 'QR'}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-xs">{formatTime(mov.created_at)}</p>
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
          )}
        </div>
      )}

      {/* Modal Abrir Caja */}
      {showAbrirModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Abrir Caja</h2>
              <p className="text-sm text-gray-500">Ingresa los montos iniciales</p>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  💵 Monto inicial Efectivo (Bs.)
                </label>
                <input
                  type="number"
                  value={montoInicialEfectivo}
                  onChange={e => setMontoInicialEfectivo(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-lg"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
                {ultimoCierreEfectivo > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Sugerido: {formatCurrency(ultimoCierreEfectivo)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  📱 Monto inicial QR (Bs.)
                </label>
                <input
                  type="number"
                  value={montoInicialQR}
                  onChange={e => setMontoInicialQR(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-lg"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
                {ultimoCierreQR > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Sugerido: {formatCurrency(ultimoCierreQR)}
                  </p>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowAbrirModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAbrirCaja}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50"
              >
                {saving ? 'Abriendo...' : 'Abrir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cerrar Caja */}
      {showCerrarModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Cerrar Caja</h2>
              <p className="text-sm text-gray-500">Ingresa los montos contados</p>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
              
              {resumen && (
                <div className="p-3 bg-gray-50 rounded-lg space-y-1">
                  <p className="text-sm text-gray-500">Totales esperados:</p>
                  <p className="text-sm font-medium">💵 Efectivo: {formatCurrency(resumen.total_efectivo)}</p>
                  <p className="text-sm font-medium">📱 QR: {formatCurrency(resumen.total_qr)}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  💵 Monto contado Efectivo (Bs.)
                </label>
                <input
                  type="number"
                  value={montoFinalEfectivo}
                  onChange={e => setMontoFinalEfectivo(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-lg"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
                {resumen && montoFinalEfectivo && (
                  <p className={`text-xs mt-1 ${
                    parseFloat(montoFinalEfectivo) === resumen.total_efectivo
                      ? 'text-emerald-600'
                      : parseFloat(montoFinalEfectivo) > resumen.total_efectivo
                      ? 'text-blue-600'
                      : 'text-red-600'
                  }`}>
                    Diferencia: {formatCurrency(parseFloat(montoFinalEfectivo) - resumen.total_efectivo)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  📱 Monto contado QR (Bs.)
                </label>
                <input
                  type="number"
                  value={montoFinalQR}
                  onChange={e => setMontoFinalQR(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-lg"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
                {resumen && montoFinalQR && (
                  <p className={`text-xs mt-1 ${
                    parseFloat(montoFinalQR) === resumen.total_qr
                      ? 'text-emerald-600'
                      : parseFloat(montoFinalQR) > resumen.total_qr
                      ? 'text-blue-600'
                      : 'text-red-600'
                  }`}>
                    Diferencia: {formatCurrency(parseFloat(montoFinalQR) - resumen.total_qr)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas (opcional)
                </label>
                <textarea
                  value={notasCierre}
                  onChange={e => setNotasCierre(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none"
                  rows={2}
                  placeholder="Observaciones del cierre..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowCerrarModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCerrarCaja}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:opacity-50"
              >
                {saving ? 'Cerrando...' : 'Cerrar Caja'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Retiro */}
      {showRetiroModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Retiro de Caja</h2>
              <p className="text-sm text-gray-500">Solo se puede retirar efectivo</p>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
              
              {resumen && (
                <p className="text-sm text-gray-500">
                  Disponible en efectivo: <span className="font-medium text-gray-900">{formatCurrency(resumen.total_efectivo)}</span>
                </p>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto a retirar (Bs.)
                </label>
                <input
                  type="number"
                  value={montoRetiro}
                  onChange={e => setMontoRetiro(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-lg"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Concepto / Motivo
                </label>
                <input
                  type="text"
                  value={conceptoRetiro}
                  onChange={e => setConceptoRetiro(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  placeholder="Ej: Pago a proveedor"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowRetiroModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleRetiro}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 disabled:opacity-50"
              >
                {saving ? 'Procesando...' : 'Retirar'}
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
