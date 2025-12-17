'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { formatCurrency } from '@/lib/utils/format'
import { formatDateTime, formatTime } from '@/lib/utils/timezone'
import Link from 'next/link'

interface Caja {
  id: string
  nombre: string
  monto_inicial: number
  monto_final: number | null
  fecha_apertura: string
  fecha_cierre: string | null
  estado: 'abierta' | 'cerrada'
  notas: string | null
  usuario_id: string
  usuario_nombre: string
}

interface MovimientoCaja {
  id: string
  tipo: 'ingreso' | 'egreso' | 'retiro' | 'apertura' | 'cierre'
  concepto: string
  monto: number
  metodo_pago: 'efectivo' | 'qr' | null
  created_at: string
}

interface ResumenCaja {
  totalEfectivo: number
  totalQR: number
  ventasEfectivo: number
  ventasQR: number
  pagosCredito: number
  comprasEfectivo: number
  comprasQR: number
  gastosEfectivo: number
  gastosQR: number
  retiros: number
}

export default function CajaPage() {
  const [miCaja, setMiCaja] = useState<Caja | null>(null)
  const [otrasCajas, setOtrasCajas] = useState<Caja[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([])
  const [loading, setLoading] = useState(true)
  const [resumen, setResumen] = useState<ResumenCaja | null>(null)
  
  // Estados para modales
  const [showAbrirCaja, setShowAbrirCaja] = useState(false)
  const [showCerrarCaja, setShowCerrarCaja] = useState(false)
  const [showRetiro, setShowRetiro] = useState(false)
  
  // Formularios
  const [montoInicial, setMontoInicial] = useState('')
  const [montoSugerido, setMontoSugerido] = useState(0)
  const [montoContado, setMontoContado] = useState('')
  const [notasCierre, setNotasCierre] = useState('')
  const [montoRetiro, setMontoRetiro] = useState('')
  const [conceptoRetiro, setConceptoRetiro] = useState('')
  
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const { usuario } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (usuario?.sucursal_id && usuario?.id) {
      loadData()
    }
  }, [usuario?.sucursal_id, usuario?.id])

  const loadData = async () => {
    if (!usuario?.sucursal_id || !usuario?.id) return

    setLoading(true)
    try {
      // Buscar MI caja abierta
      const { data: miCajaData } = await supabase
        .from('cajas')
        .select(`
          *,
          usuario:usuarios(nombre)
        `)
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('usuario_id', usuario.id)
        .eq('estado', 'abierta')
        .maybeSingle()

      if (miCajaData) {
        setMiCaja({
          ...miCajaData,
          usuario_nombre: miCajaData.usuario?.nombre || 'Desconocido'
        })

        // Cargar movimientos de mi caja
        const { data: movimientosData } = await supabase
          .from('movimientos_caja')
          .select('*')
          .eq('caja_id', miCajaData.id)
          .order('created_at', { ascending: false })

        setMovimientos(movimientosData || [])

        // Calcular resumen
        calcularResumen(movimientosData || [], miCajaData.monto_inicial)
      } else {
        setMiCaja(null)
        setMovimientos([])
        setResumen(null)

        // Obtener último monto de cierre para sugerencia
        const { data: ultimaCaja } = await supabase
          .from('cajas')
          .select('monto_final')
          .eq('usuario_id', usuario.id)
          .eq('estado', 'cerrada')
          .order('fecha_cierre', { ascending: false })
          .limit(1)
          .maybeSingle()

        setMontoSugerido(ultimaCaja?.monto_final || 0)
      }

      // Buscar OTRAS cajas abiertas en la sucursal (de otros usuarios)
      const { data: otrasCajasData } = await supabase
        .from('cajas')
        .select(`
          *,
          usuario:usuarios(nombre)
        `)
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('estado', 'abierta')
        .neq('usuario_id', usuario.id)

      if (otrasCajasData) {
        setOtrasCajas(otrasCajasData.map(c => ({
          ...c,
          usuario_nombre: c.usuario?.nombre || 'Desconocido'
        })))
      }

    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }

  const calcularResumen = (movs: MovimientoCaja[], montoInicial: number) => {
    const resumen: ResumenCaja = {
      totalEfectivo: montoInicial,
      totalQR: 0,
      ventasEfectivo: 0,
      ventasQR: 0,
      pagosCredito: 0,
      comprasEfectivo: 0,
      comprasQR: 0,
      gastosEfectivo: 0,
      gastosQR: 0,
      retiros: 0
    }

    movs.forEach(mov => {
      if (mov.tipo === 'ingreso') {
        if (mov.metodo_pago === 'efectivo') {
          resumen.totalEfectivo += mov.monto
          if (mov.concepto.toLowerCase().includes('venta')) {
            resumen.ventasEfectivo += mov.monto
          } else if (mov.concepto.toLowerCase().includes('pago') || mov.concepto.toLowerCase().includes('crédito')) {
            resumen.pagosCredito += mov.monto
          }
        } else if (mov.metodo_pago === 'qr') {
          resumen.totalQR += mov.monto
          if (mov.concepto.toLowerCase().includes('venta')) {
            resumen.ventasQR += mov.monto
          }
        }
      } else if (mov.tipo === 'egreso') {
        if (mov.metodo_pago === 'efectivo') {
          resumen.totalEfectivo -= mov.monto
          if (mov.concepto.toLowerCase().includes('compra')) {
            resumen.comprasEfectivo += mov.monto
          } else if (mov.concepto.toLowerCase().includes('gasto')) {
            resumen.gastosEfectivo += mov.monto
          }
        } else if (mov.metodo_pago === 'qr') {
          resumen.totalQR -= mov.monto
          if (mov.concepto.toLowerCase().includes('compra')) {
            resumen.comprasQR += mov.monto
          } else if (mov.concepto.toLowerCase().includes('gasto')) {
            resumen.gastosQR += mov.monto
          }
        }
      } else if (mov.tipo === 'retiro') {
        resumen.totalEfectivo -= mov.monto
        resumen.retiros += mov.monto
      }
    })

    setResumen(resumen)
  }

  // Abrir caja
  const abrirCaja = async () => {
    if (!usuario?.sucursal_id || !usuario?.id) return

    const monto = parseFloat(montoInicial) || 0
    if (monto < 0) {
      setError('El monto inicial no puede ser negativo')
      return
    }

    setGuardando(true)
    setError('')

    try {
      // Crear la caja
      const { data: nuevaCaja, error: cajaError } = await supabase
        .from('cajas')
        .insert({
          sucursal_id: usuario.sucursal_id,
          usuario_id: usuario.id,
          nombre: `Caja de ${usuario.nombre || 'Usuario'}`,
          monto_inicial: monto,
          estado: 'abierta'
        })
        .select()
        .single()

      if (cajaError) throw cajaError

      // Registrar movimiento de apertura
      await supabase.from('movimientos_caja').insert({
        caja_id: nuevaCaja.id,
        tipo: 'apertura',
        concepto: 'Apertura de caja',
        monto: monto,
        metodo_pago: 'efectivo'
      })

      setShowAbrirCaja(false)
      setMontoInicial('')
      await loadData()
    } catch (err) {
      console.error('Error abriendo caja:', err)
      setError('Error al abrir la caja')
    } finally {
      setGuardando(false)
    }
  }

  // Cerrar caja
  const cerrarCaja = async () => {
    if (!miCaja || !usuario?.id) return

    const montoReal = parseFloat(montoContado) || 0
    if (montoReal < 0) {
      setError('El monto contado no puede ser negativo')
      return
    }

    setGuardando(true)
    setError('')

    try {
      // Actualizar la caja
      const { error: updateError } = await supabase
        .from('cajas')
        .update({
          monto_final: montoReal,
          fecha_cierre: new Date().toISOString(),
          estado: 'cerrada',
          notas: notasCierre.trim() || null
        })
        .eq('id', miCaja.id)

      if (updateError) throw updateError

      // Registrar movimiento de cierre
      await supabase.from('movimientos_caja').insert({
        caja_id: miCaja.id,
        tipo: 'cierre',
        concepto: 'Cierre de caja',
        monto: montoReal,
        metodo_pago: 'efectivo'
      })

      setShowCerrarCaja(false)
      setMontoContado('')
      setNotasCierre('')
      await loadData()
    } catch (err) {
      console.error('Error cerrando caja:', err)
      setError('Error al cerrar la caja')
    } finally {
      setGuardando(false)
    }
  }

  // Registrar retiro
  const registrarRetiro = async () => {
    if (!miCaja) return

    const monto = parseFloat(montoRetiro) || 0
    if (monto <= 0) {
      setError('Ingrese un monto válido')
      return
    }

    if (!conceptoRetiro.trim()) {
      setError('Ingrese el motivo del retiro')
      return
    }

    if (resumen && monto > resumen.totalEfectivo) {
      setError('El monto supera el efectivo disponible')
      return
    }

    setGuardando(true)
    setError('')

    try {
      await supabase.from('movimientos_caja').insert({
        caja_id: miCaja.id,
        tipo: 'retiro',
        concepto: conceptoRetiro.trim(),
        monto: monto,
        metodo_pago: 'efectivo'
      })

      setShowRetiro(false)
      setMontoRetiro('')
      setConceptoRetiro('')
      await loadData()
    } catch (err) {
      console.error('Error registrando retiro:', err)
      setError('Error al registrar el retiro')
    } finally {
      setGuardando(false)
    }
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

  // Vista sin caja abierta
  if (!miCaja) {
    return (
      <div className="p-4 pb-24 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mi Caja</h1>
            <p className="text-gray-500 text-sm">Control de efectivo</p>
          </div>
          <Link
            href="/dashboard/caja/historial"
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </Link>
        </div>

        {/* Aviso de otras cajas abiertas */}
        {otrasCajas.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">Cajas abiertas en esta sucursal:</span>
            </div>
            {otrasCajas.map(caja => (
              <p key={caja.id} className="ml-7">• {caja.usuario_nombre} - desde {formatTime(caja.fecha_apertura)}</p>
            ))}
          </div>
        )}

        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Caja Cerrada</h3>
          <p className="text-gray-500 mb-6">Abre tu caja para comenzar a registrar ventas</p>
          <button
            onClick={() => {
              setMontoInicial(montoSugerido.toString())
              setShowAbrirCaja(true)
            }}
            className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600"
          >
            Abrir Mi Caja
          </button>
          {montoSugerido > 0 && (
            <p className="text-sm text-gray-500 mt-3">
              Último cierre: {formatCurrency(montoSugerido)}
            </p>
          )}
        </div>

        {/* Modal abrir caja */}
        {showAbrirCaja && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-sm">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">Abrir Caja</h2>
              </div>
              <div className="p-6 space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monto inicial en efectivo
                  </label>
                  <input
                    type="number"
                    value={montoInicial}
                    onChange={e => setMontoInicial(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg text-center"
                    min="0"
                    step="0.01"
                  />
                  {montoSugerido > 0 && (
                    <button
                      onClick={() => setMontoInicial(montoSugerido.toString())}
                      className="mt-2 text-sm text-emerald-600 hover:underline"
                    >
                      Usar último cierre: {formatCurrency(montoSugerido)}
                    </button>
                  )}
                </div>
              </div>
              <div className="p-6 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => {
                    setShowAbrirCaja(false)
                    setError('')
                  }}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  onClick={abrirCaja}
                  disabled={guardando}
                  className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-xl font-medium disabled:opacity-50"
                >
                  {guardando ? 'Abriendo...' : 'Abrir Caja'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Vista con caja abierta
  return (
    <div className="p-4 pb-24 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi Caja</h1>
          <p className="text-gray-500 text-sm">
            Abierta: {formatTime(miCaja.fecha_apertura)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/caja/historial"
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </Link>
          <button
            onClick={() => setShowRetiro(true)}
            className="px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200"
          >
            Retiro
          </button>
        </div>
      </div>

      {/* Aviso de otras cajas abiertas */}
      {otrasCajas.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>También tiene caja abierta: {otrasCajas.map(c => c.usuario_nombre).join(', ')}</span>
          </div>
        </div>
      )}

      {/* Resumen */}
      {resumen && (
        <div className="space-y-4 mb-6">
          {/* Totales principales */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="text-sm text-emerald-700">Efectivo</span>
              </div>
              <p className="text-2xl font-bold text-emerald-700">{formatCurrency(resumen.totalEfectivo)}</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                <span className="text-sm text-purple-700">QR</span>
              </div>
              <p className="text-2xl font-bold text-purple-700">{formatCurrency(resumen.totalQR)}</p>
            </div>
          </div>

          {/* Desglose */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="font-medium text-gray-900 mb-3">Desglose del día</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Monto inicial</span>
                <span className="font-medium">{formatCurrency(miCaja.monto_inicial)}</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>+ Ventas efectivo</span>
                <span className="font-medium">{formatCurrency(resumen.ventasEfectivo)}</span>
              </div>
              <div className="flex justify-between text-purple-600">
                <span>+ Ventas QR</span>
                <span className="font-medium">{formatCurrency(resumen.ventasQR)}</span>
              </div>
              {resumen.pagosCredito > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>+ Pagos de crédito</span>
                  <span className="font-medium">{formatCurrency(resumen.pagosCredito)}</span>
                </div>
              )}
              {(resumen.comprasEfectivo + resumen.comprasQR) > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>- Compras</span>
                  <span className="font-medium">{formatCurrency(resumen.comprasEfectivo + resumen.comprasQR)}</span>
                </div>
              )}
              {(resumen.gastosEfectivo + resumen.gastosQR) > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>- Gastos</span>
                  <span className="font-medium">{formatCurrency(resumen.gastosEfectivo + resumen.gastosQR)}</span>
                </div>
              )}
              {resumen.retiros > 0 && (
                <div className="flex justify-between text-yellow-600">
                  <span>- Retiros</span>
                  <span className="font-medium">{formatCurrency(resumen.retiros)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-100 font-bold text-lg">
                <span>Total esperado</span>
                <span className="text-emerald-600">{formatCurrency(resumen.totalEfectivo + resumen.totalQR)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Movimientos recientes */}
      <div className="mb-6">
        <h3 className="font-medium text-gray-900 mb-3">Movimientos recientes</h3>
        {movimientos.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-xl border border-gray-100 text-gray-500">
            No hay movimientos registrados
          </div>
        ) : (
          <div className="space-y-2">
            {movimientos.slice(0, 10).map(mov => (
              <div key={mov.id} className="bg-white rounded-xl border border-gray-100 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      mov.tipo === 'ingreso' ? 'bg-emerald-100' :
                      mov.tipo === 'egreso' ? 'bg-red-100' :
                      mov.tipo === 'retiro' ? 'bg-yellow-100' :
                      'bg-gray-100'
                    }`}>
                      {mov.tipo === 'ingreso' ? (
                        <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      ) : mov.tipo === 'egreso' || mov.tipo === 'retiro' ? (
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{mov.concepto}</p>
                      <p className="text-xs text-gray-500">
                        {formatTime(mov.created_at)}
                        {mov.metodo_pago && ` • ${mov.metodo_pago === 'efectivo' ? 'Efectivo' : 'QR'}`}
                      </p>
                    </div>
                  </div>
                  <p className={`font-bold ${
                    mov.tipo === 'ingreso' ? 'text-emerald-600' :
                    mov.tipo === 'egreso' || mov.tipo === 'retiro' ? 'text-red-600' :
                    'text-gray-600'
                  }`}>
                    {mov.tipo === 'ingreso' ? '+' : mov.tipo === 'egreso' || mov.tipo === 'retiro' ? '-' : ''}
                    {formatCurrency(mov.monto)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Botón cerrar caja */}
      <button
        onClick={() => setShowCerrarCaja(true)}
        className="w-full px-4 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600"
      >
        Cerrar Mi Caja
      </button>

      {/* Modal retiro */}
      {showRetiro && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Retiro de Caja</h2>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
                <input
                  type="number"
                  value={montoRetiro}
                  onChange={e => setMontoRetiro(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Efectivo disponible: {formatCurrency(resumen?.totalEfectivo || 0)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo *</label>
                <input
                  type="text"
                  value={conceptoRetiro}
                  onChange={e => setConceptoRetiro(e.target.value)}
                  placeholder="Ej: Retiro para depósito bancario"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setShowRetiro(false)
                  setError('')
                }}
                className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={registrarRetiro}
                disabled={guardando}
                className="flex-1 px-4 py-3 bg-yellow-500 text-white rounded-xl font-medium disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cerrar caja */}
      {showCerrarCaja && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Cerrar Caja</h2>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-500 mb-1">Efectivo esperado</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(resumen?.totalEfectivo || 0)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Efectivo contado (real)
                </label>
                <input
                  type="number"
                  value={montoContado}
                  onChange={e => setMontoContado(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg text-center"
                  min="0"
                  step="0.01"
                />
              </div>

              {montoContado && resumen && (
                <div className={`p-3 rounded-xl ${
                  parseFloat(montoContado) === resumen.totalEfectivo
                    ? 'bg-emerald-50 text-emerald-700'
                    : parseFloat(montoContado) > resumen.totalEfectivo
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-red-50 text-red-700'
                }`}>
                  <p className="font-medium">
                    Diferencia: {formatCurrency(parseFloat(montoContado) - resumen.totalEfectivo)}
                  </p>
                  <p className="text-sm">
                    {parseFloat(montoContado) === resumen.totalEfectivo
                      ? 'Cuadra perfectamente ✓'
                      : parseFloat(montoContado) > resumen.totalEfectivo
                        ? 'Sobrante de efectivo'
                        : 'Faltante de efectivo'}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea
                  value={notasCierre}
                  onChange={e => setNotasCierre(e.target.value)}
                  placeholder="Observaciones del cierre..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none"
                  rows={2}
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setShowCerrarCaja(false)
                  setError('')
                }}
                className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={cerrarCaja}
                disabled={guardando || !montoContado}
                className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-medium disabled:opacity-50"
              >
                {guardando ? 'Cerrando...' : 'Cerrar Caja'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}