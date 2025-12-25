// Path: app\dashboard\gastos\page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { formatCurrency } from '@/lib/utils/format'
import { formatDateTime } from '@/lib/utils/timezone'
import * as XLSX from 'xlsx'

// Categorías predefinidas de gastos con iconos SVG
const CATEGORIAS_GASTO = [
  { id: 'alquiler', nombre: 'Alquiler', icono: 'home' },
  { id: 'servicios', nombre: 'Servicios', icono: 'bolt' },
  { id: 'sueldos', nombre: 'Sueldos', icono: 'users' },
  { id: 'transporte', nombre: 'Transporte', icono: 'truck' },
  { id: 'limpieza', nombre: 'Limpieza', icono: 'sparkles' },
  { id: 'mantenimiento', nombre: 'Mantenimiento', icono: 'wrench' },
  { id: 'publicidad', nombre: 'Publicidad', icono: 'megaphone' },
  { id: 'impuestos', nombre: 'Impuestos', icono: 'document' },
  { id: 'seguridad', nombre: 'Seguridad', icono: 'shield' },
  { id: 'telefono', nombre: 'Teléfono', icono: 'phone' },
  { id: 'papeleria', nombre: 'Papelería', icono: 'clipboard' },
  { id: 'combustible', nombre: 'Combustible', icono: 'fire' },
  { id: 'otros', nombre: 'Otros', icono: 'dots' },
]

// Componente de icono
const CategoriaIcon = ({ tipo, className = "w-5 h-5" }: { tipo: string, className?: string }) => {
  switch (tipo) {
    case 'home':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    case 'bolt':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    case 'users':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    case 'truck':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      )
    case 'sparkles':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      )
    case 'wrench':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    case 'megaphone':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
      )
    case 'document':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    case 'shield':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    case 'phone':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      )
    case 'clipboard':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )
    case 'fire':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
        </svg>
      )
    default:
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
        </svg>
      )
  }
}

interface Gasto {
  id: string
  numero_gasto: number
  categoria: string
  descripcion: string
  monto: number
  metodo_pago: string
  fecha_gasto: string
  created_at: string
  usuario_nombre: string
}

interface SaldoCaja {
  efectivo: number
  qr: number
}

export default function GastosPage() {
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroFecha, setFiltroFecha] = useState<'hoy' | 'semanal' | 'mensual'>('semanal')
  const [filtroCategoria, setFiltroCategoria] = useState('todos')
  const [gastoSeleccionado, setGastoSeleccionado] = useState<Gasto | null>(null)
  
  // Estados para nuevo gasto
  const [showNuevoGasto, setShowNuevoGasto] = useState(false)
  const [categoria, setCategoria] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [monto, setMonto] = useState('')
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'qr'>('efectivo')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [cajaAbierta, setCajaAbierta] = useState(false)
  const [cajaId, setCajaId] = useState<string | null>(null)
  const [saldoCaja, setSaldoCaja] = useState<SaldoCaja>({ efectivo: 0, qr: 0 })
  
  // 🆕 NUEVO: Estado para pago fuera de caja
  const [pagoFueraCaja, setPagoFueraCaja] = useState(false)
  
  // Estado para éxito
  const [showExito, setShowExito] = useState(false)
  const [gastoExitoso, setGastoExitoso] = useState<number | null>(null)

  const { usuario } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (usuario?.sucursal_id) {
      loadData()
    }
  }, [usuario?.sucursal_id, filtroFecha])

  const loadData = async () => {
    if (!usuario?.sucursal_id) return

    setLoading(true)
    try {
      // Verificar caja abierta y obtener saldo
      const { data: cajaData } = await supabase
        .from('cajas')
        .select('id, monto_inicial, monto_inicial_qr')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('estado', 'abierta')
        .maybeSingle()

      setCajaAbierta(!!cajaData)
      setCajaId(cajaData?.id || null)

      // Calcular saldo disponible en caja
      if (cajaData) {
        const { data: movimientos } = await supabase
          .from('movimientos_caja')
          .select('tipo, monto, metodo_pago')
          .eq('caja_id', cajaData.id)

        let saldoEfectivo = cajaData.monto_inicial || 0
        let saldoQR = cajaData.monto_inicial_qr || 0

        if (movimientos) {
          movimientos.forEach(mov => {
            if (mov.metodo_pago === 'efectivo') {
              if (mov.tipo === 'ingreso') {
                saldoEfectivo += mov.monto
              } else if (mov.tipo === 'egreso' || mov.tipo === 'retiro') {
                saldoEfectivo -= mov.monto
              }
            } else if (mov.metodo_pago === 'qr') {
              if (mov.tipo === 'ingreso') {
                saldoQR += mov.monto
              } else if (mov.tipo === 'egreso') {
                saldoQR -= mov.monto
              }
            }
          })
        }

        setSaldoCaja({ efectivo: saldoEfectivo, qr: saldoQR })
      }

      // Calcular fechas según filtro
      const ahora = new Date()
      let fechaInicio: Date

      switch (filtroFecha) {
        case 'hoy':
          fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
          break
        case 'semanal':
          fechaInicio = new Date(ahora)
          fechaInicio.setDate(ahora.getDate() - 7)
          break
        case 'mensual':
          fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
          break
      }

      // Cargar gastos
      const { data: gastosData } = await supabase
        .from('gastos')
        .select('*')
        .eq('sucursal_id', usuario.sucursal_id)
        .gte('created_at', fechaInicio.toISOString())
        .order('created_at', { ascending: false })

      if (gastosData && gastosData.length > 0) {
        const usuarioIds = [...new Set(gastosData.map(g => g.usuario_id))]
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

        const gastosCompletos: Gasto[] = gastosData.map(gasto => ({
          id: gasto.id,
          numero_gasto: gasto.numero_gasto,
          categoria: gasto.categoria,
          descripcion: gasto.descripcion,
          monto: gasto.monto,
          metodo_pago: gasto.metodo_pago,
          fecha_gasto: gasto.fecha_gasto,
          created_at: gasto.created_at,
          usuario_nombre: usuariosMap[gasto.usuario_id] || 'Desconocido'
        }))

        setGastos(gastosCompletos)
      } else {
        setGastos([])
      }

    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }

  // Obtener categoría info
  const getCategoriaInfo = (id: string) => {
    return CATEGORIAS_GASTO.find(c => c.id === id) || { id, nombre: id, icono: 'dots' }
  }

  // Filtrar gastos
  const gastosFiltrados = useMemo(() => {
    if (filtroCategoria === 'todos') return gastos
    return gastos.filter(g => g.categoria === filtroCategoria)
  }, [gastos, filtroCategoria])

  // Totales
  const totalGastos = gastosFiltrados.reduce((sum, g) => sum + g.monto, 0)
  const totalEfectivo = gastosFiltrados.filter(g => g.metodo_pago === 'efectivo').reduce((sum, g) => sum + g.monto, 0)
  const totalQR = gastosFiltrados.filter(g => g.metodo_pago === 'qr').reduce((sum, g) => sum + g.monto, 0)

  // Saldo disponible según método de pago
  const saldoDisponible = metodoPago === 'efectivo' ? saldoCaja.efectivo : saldoCaja.qr
  const montoNum = parseFloat(monto) || 0

  // Gastos por categoría
  const gastosPorCategoria = useMemo(() => {
    const resultado: Record<string, number> = {}
    gastos.forEach(g => {
      resultado[g.categoria] = (resultado[g.categoria] || 0) + g.monto
    })
    return Object.entries(resultado)
      .map(([cat, total]) => ({ categoria: cat, total }))
      .sort((a, b) => b.total - a.total)
  }, [gastos])

  // Guardar gasto
  const guardarGasto = async () => {
    if (!usuario?.sucursal_id || !usuario?.id) return

    if (!categoria) {
      setError('Seleccione una categoría')
      return
    }
    if (!descripcion.trim()) {
      setError('Ingrese una descripción')
      return
    }
    if (!montoNum || montoNum <= 0) {
      setError('Ingrese un monto válido')
      return
    }

    // 🆕 MODIFICADO: Solo validar saldo si NO es pago fuera de caja
    if (!pagoFueraCaja) {
      if (!cajaId) {
        setError('Debe abrir la caja primero')
        return
      }
      if (montoNum > saldoDisponible) {
        setError(`Saldo insuficiente. Disponible en ${metodoPago === 'efectivo' ? 'efectivo' : 'QR'}: ${formatCurrency(saldoDisponible)}`)
        return
      }
    }

    setGuardando(true)
    setError('')

    try {
      const { data: maxGasto } = await supabase
        .from('gastos')
        .select('numero_gasto')
        .eq('sucursal_id', usuario.sucursal_id)
        .order('numero_gasto', { ascending: false })
        .limit(1)
        .maybeSingle()

      const numeroGasto = (maxGasto?.numero_gasto || 0) + 1

      // 🆕 MODIFICADO: caja_id es NULL si es pago fuera de caja
      const { data: gasto, error: gastoError } = await supabase
        .from('gastos')
        .insert({
          sucursal_id: usuario.sucursal_id,
          usuario_id: usuario.id,
          caja_id: pagoFueraCaja ? null : cajaId,
          numero_gasto: numeroGasto,
          categoria,
          descripcion: descripcion.trim(),
          monto: montoNum,
          metodo_pago: metodoPago
        })
        .select()
        .single()

      if (gastoError) throw gastoError

      // 🆕 MODIFICADO: Solo registrar en caja si NO es pago fuera de caja
      if (!pagoFueraCaja && cajaId) {
        const catInfo = getCategoriaInfo(categoria)
        await supabase.from('movimientos_caja').insert({
          caja_id: cajaId,
          tipo: 'egreso',
          concepto: `Gasto #${numeroGasto} - ${catInfo.nombre}: ${descripcion.trim()}`,
          referencia_id: gasto.id,
          referencia_tipo: 'gasto',
          monto: montoNum,
          metodo_pago: metodoPago
        })
      }

      setShowNuevoGasto(false)
      setCategoria('')
      setDescripcion('')
      setMonto('')
      setMetodoPago('efectivo')
      setPagoFueraCaja(false) // Reset

      setGastoExitoso(numeroGasto)
      setShowExito(true)
      setTimeout(() => {
        setShowExito(false)
        setGastoExitoso(null)
      }, 3000)

      loadData()

    } catch (err) {
      console.error('Error guardando gasto:', err)
      setError('Error al guardar el gasto')
    } finally {
      setGuardando(false)
    }
  }

  // Abrir modal nuevo gasto
  const abrirNuevoGasto = () => {
    setCategoria('')
    setDescripcion('')
    setMonto('')
    setPagoFueraCaja(false) // Reset
    setMetodoPago('efectivo')
    setError('')
    setShowNuevoGasto(true)
  }

  // Exportar a Excel
  const exportarExcel = () => {
    if (gastosFiltrados.length === 0) return

    const datosExcel = gastosFiltrados.map(gasto => {
      const catInfo = getCategoriaInfo(gasto.categoria)
      return {
        'Gasto #': gasto.numero_gasto,
        'Fecha': formatDateTime(gasto.created_at),
        'Categoría': catInfo.nombre,
        'Descripción': gasto.descripcion,
        'Monto': gasto.monto,
        'Método Pago': gasto.metodo_pago === 'efectivo' ? 'Efectivo' : 'QR',
        'Usuario': gasto.usuario_nombre
      }
    })

    const resumenCategoria = gastosPorCategoria.map(item => {
      const catInfo = getCategoriaInfo(item.categoria)
      return {
        'Categoría': catInfo.nombre,
        'Total': item.total
      }
    })

    const wb = XLSX.utils.book_new()
    
    const ws1 = XLSX.utils.json_to_sheet(datosExcel)
    XLSX.utils.book_append_sheet(wb, ws1, 'Gastos')
    
    const ws2 = XLSX.utils.json_to_sheet(resumenCategoria)
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumen por Categoría')
    
    XLSX.writeFile(wb, `Gastos_${filtroFecha}.xlsx`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando gastos...</p>
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Gasto Registrado!</h2>
            <p className="text-emerald-600 text-lg font-medium">Gasto #{gastoExitoso}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gastos</h1>
          <p className="text-gray-500 text-sm">{gastosFiltrados.length} gastos en el período</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportarExcel}
            disabled={gastosFiltrados.length === 0}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <button
            onClick={abrirNuevoGasto}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Gasto
          </button>
        </div>
      </div>

      {!cajaAbierta && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          La caja está cerrada. Debe abrirla para registrar gastos.
        </div>
      )}

      {error && !showNuevoGasto && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Saldo disponible */}
      {cajaAbierta && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Saldo disponible en caja:
          </span>
          <span className="font-medium">
            Efectivo: {formatCurrency(saldoCaja.efectivo)} | QR: {formatCurrency(saldoCaja.qr)}
          </span>
        </div>
      )}

      {/* Filtros de fecha */}
      <div className="flex gap-2 mb-4">
        {(['hoy', 'semanal', 'mensual'] as const).map(filtro => (
          <button
            key={filtro}
            onClick={() => setFiltroFecha(filtro)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 ${
              filtroFecha === filtro
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {filtro === 'hoy' ? 'Hoy' : filtro === 'semanal' ? 'Semanal' : 'Mensual'}
          </button>
        ))}
      </div>

      {/* Filtro por categoría */}
      <div className="mb-4">
        <select
          value={filtroCategoria}
          onChange={e => setFiltroCategoria(e.target.value)}
          className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-white text-sm"
        >
          <option value="todos">Todas las categorías</option>
          {CATEGORIAS_GASTO.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.nombre}</option>
          ))}
        </select>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-red-50 rounded-xl p-3 text-center">
          <p className="text-red-600 font-bold text-lg">{formatCurrency(totalGastos)}</p>
          <p className="text-red-700 text-xs">Total</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-3 text-center">
          <p className="text-emerald-600 font-bold text-lg">{formatCurrency(totalEfectivo)}</p>
          <p className="text-emerald-700 text-xs">Efectivo</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <p className="text-blue-600 font-bold text-lg">{formatCurrency(totalQR)}</p>
          <p className="text-blue-700 text-xs">QR</p>
        </div>
      </div>

      {/* Resumen por categoría */}
      {filtroCategoria === 'todos' && gastosPorCategoria.length > 0 && (
        <div className="mb-6 bg-white rounded-xl border border-gray-100 p-4">
          <h3 className="font-medium text-gray-900 mb-3">Por categoría</h3>
          <div className="space-y-2">
            {gastosPorCategoria.slice(0, 5).map(item => {
              const catInfo = getCategoriaInfo(item.categoria)
              const porcentaje = (item.total / totalGastos) * 100
              return (
                <div key={item.categoria} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600">
                    <CategoriaIcon tipo={catInfo.icono} className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">{catInfo.nombre}</span>
                      <span className="font-medium text-gray-900">{formatCurrency(item.total)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full mt-1">
                      <div 
                        className="h-2 bg-red-400 rounded-full"
                        style={{ width: `${porcentaje}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Lista de gastos */}
      {gastosFiltrados.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No hay gastos</h3>
          <p className="text-gray-500">No se encontraron gastos en este período</p>
        </div>
      ) : (
        <div className="space-y-3">
          {gastosFiltrados.map(gasto => {
            const catInfo = getCategoriaInfo(gasto.categoria)
            return (
              <div
                key={gasto.id}
                onClick={() => setGastoSeleccionado(gasto)}
                className="bg-white rounded-xl border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-red-600">
                      <CategoriaIcon tipo={catInfo.icono} className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{gasto.descripcion}</p>
                      <p className="text-gray-500 text-sm">{catInfo.nombre}</p>
                      <p className="text-gray-400 text-xs">{formatDateTime(gasto.created_at)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-red-600">{formatCurrency(gasto.monto)}</p>
                    <p className="text-xs text-gray-500 flex items-center justify-end gap-1">
                      {gasto.metodo_pago === 'efectivo' ? (
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
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Nuevo Gasto */}
      {showNuevoGasto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Nuevo Gasto</h2>
                <button onClick={() => setShowNuevoGasto(false)} className="text-gray-400 hover:text-gray-600">
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

              {/* 🆕 CHECKBOX PAGO FUERA DE CAJA */}
              <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pagoFueraCaja}
                    onChange={(e) => setPagoFueraCaja(e.target.checked)}
                    className="mt-1 w-5 h-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      <span className="font-semibold text-purple-900">Pago fuera de caja</span>
                    </div>
                    <p className="text-xs text-purple-700 mt-1">
                      Marca esta opción si pagas con cuenta bancaria o dinero fuera de la caja física
                    </p>
                  </div>
                </label>
              </div>

              {/* Saldo disponible en modal - SOLO SI NO ES FUERA DE CAJA */}
              {!pagoFueraCaja && cajaAbierta && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Saldo disponible:</span>
                    <div className="text-right">
                      <p className={metodoPago === 'efectivo' ? 'font-bold text-emerald-600' : 'text-gray-400'}>
                        Efectivo: {formatCurrency(saldoCaja.efectivo)}
                      </p>
                      <p className={metodoPago === 'qr' ? 'font-bold text-blue-600' : 'text-gray-400'}>
                        QR: {formatCurrency(saldoCaja.qr)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Categoría */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Categoría *</label>
                <div className="grid grid-cols-4 gap-2">
                  {CATEGORIAS_GASTO.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setCategoria(cat.id)}
                      className={`p-2 rounded-xl text-center border-2 transition-all ${
                        categoria === cat.id
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <div className={`w-8 h-8 mx-auto mb-1 rounded-lg flex items-center justify-center ${
                        categoria === cat.id ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <CategoriaIcon tipo={cat.icono} className="w-4 h-4" />
                      </div>
                      <span className="text-xs text-gray-700 line-clamp-1">{cat.nombre}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
                <input
                  type="text"
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  placeholder="Ej: Pago de luz mes de diciembre"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                />
              </div>

              {/* Monto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto (Bs.) *</label>
                <input
                  type="number"
                  value={monto}
                  onChange={e => setMonto(e.target.value)}
                  placeholder="0.00"
                  className={`w-full px-4 py-2 border rounded-xl text-lg font-medium ${
                    montoNum > saldoDisponible ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  }`}
                  step="0.01"
                  min="0"
                />
                {montoNum > saldoDisponible && (
                  <p className="text-red-500 text-xs mt-1">
                    Excede el saldo disponible en {metodoPago === 'efectivo' ? 'efectivo' : 'QR'}
                  </p>
                )}
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
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowNuevoGasto(false)}
                className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={guardarGasto}
                disabled={guardando || !categoria || !descripcion || !monto || montoNum > saldoDisponible}
                className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-xl font-medium disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : 'Guardar Gasto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle gasto */}
      {gastoSeleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Gasto #{gastoSeleccionado.numero_gasto}</h2>
                <button onClick={() => setGastoSeleccionado(null)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {(() => {
                const catInfo = getCategoriaInfo(gastoSeleccionado.categoria)
                return (
                  <>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-600">
                        <CategoriaIcon tipo={catInfo.icono} className="w-8 h-8" />
                      </div>
                      <div>
                        <p className="font-bold text-2xl text-red-600">{formatCurrency(gastoSeleccionado.monto)}</p>
                        <p className="text-gray-500">{catInfo.nombre}</p>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-xl">
                      <p className="text-gray-700">{gastoSeleccionado.descripcion}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">Fecha</span>
                        <p className="font-medium">{formatDateTime(gastoSeleccionado.created_at)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Método de pago</span>
                        <p className="font-medium flex items-center gap-1">
                          {gastoSeleccionado.metodo_pago === 'efectivo' ? (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              Efectivo
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                              QR
                            </>
                          )}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500">Registrado por</span>
                        <p className="font-medium">{gastoSeleccionado.usuario_nombre}</p>
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>

            <div className="p-6 border-t border-gray-100">
              <button
                onClick={() => setGastoSeleccionado(null)}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200"
              >
                Cerrar
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