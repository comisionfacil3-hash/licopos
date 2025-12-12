// lib/hooks/use-caja.ts
// LICOPOS v2.1 - Hook para Gestión de Caja
// Maneja apertura, cierre y estado de caja

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Caja, MovimientoCaja, ResumenCaja } from '@/types/database'

interface UseCajaOptions {
  sucursalId: string
  usuarioId: string
}

interface UseCajaReturn {
  // Estado
  cajaAbierta: Caja | null
  loading: boolean
  error: string | null
  resumen: ResumenCaja | null
  movimientos: MovimientoCaja[]
  ultimoCierre: number
  
  // Acciones
  abrirCaja: (montoInicial: number, notas?: string) => Promise<Caja | null>
  cerrarCaja: (montoFinal: number, notas?: string) => Promise<boolean>
  registrarRetiro: (monto: number, concepto: string) => Promise<boolean>
  refetch: () => Promise<void>
}

export function useCaja({ sucursalId, usuarioId }: UseCajaOptions): UseCajaReturn {
  const [cajaAbierta, setCajaAbierta] = useState<Caja | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resumen, setResumen] = useState<ResumenCaja | null>(null)
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([])
  const [ultimoCierre, setUltimoCierre] = useState<number>(0)
  
  const supabase = createClient()
  
  // Cargar estado de caja
  const fetchCajaAbierta = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Buscar caja abierta
      const { data: caja, error: cajaError } = await supabase
        .from('cajas')
        .select('*, usuario:usuarios(id, nombre)')
        .eq('sucursal_id', sucursalId)
        .eq('estado', 'abierta')
        .order('fecha_apertura', { ascending: false })
        .limit(1)
        .single()
      
      if (cajaError && cajaError.code !== 'PGRST116') {
        throw cajaError
      }
      
      setCajaAbierta(caja || null)
      
      // Si hay caja abierta, cargar movimientos y calcular resumen
      if (caja) {
        await fetchMovimientos(caja.id)
        await calcularResumen(caja)
      }
      
      // Obtener último cierre para sugerencia
      await fetchUltimoCierre()
      
    } catch (err) {
      console.error('Error al cargar caja:', err)
      setError('Error al cargar estado de caja')
    } finally {
      setLoading(false)
    }
  }, [sucursalId, supabase])
  
  // Cargar movimientos de la caja actual
  const fetchMovimientos = async (cajaId: string) => {
    const { data, error } = await supabase
      .from('movimientos_caja')
      .select('*')
      .eq('caja_id', cajaId)
      .order('created_at', { ascending: false })
    
    if (!error && data) {
      setMovimientos(data)
    }
  }
  
  // Calcular resumen de caja
  const calcularResumen = async (caja: Caja) => {
    const { data: movs } = await supabase
      .from('movimientos_caja')
      .select('*')
      .eq('caja_id', caja.id)
    
    if (!movs) return
    
    const resumenCalc: ResumenCaja = {
      monto_inicial: caja.monto_inicial,
      ventas_efectivo: 0,
      ventas_qr: 0,
      pagos_credito_efectivo: 0,
      pagos_credito_qr: 0,
      gastos_efectivo: 0,
      gastos_qr: 0,
      compras_efectivo: 0,
      compras_qr: 0,
      retiros: 0,
      total_efectivo: caja.monto_inicial,
      total_qr: 0,
      total_esperado: caja.monto_inicial
    }
    
    movs.forEach(mov => {
      if (mov.tipo === 'ingreso') {
        if (mov.referencia_tipo === 'venta') {
          if (mov.metodo_pago === 'efectivo') {
            resumenCalc.ventas_efectivo += mov.monto
            resumenCalc.total_efectivo += mov.monto
          } else if (mov.metodo_pago === 'qr') {
            resumenCalc.ventas_qr += mov.monto
            resumenCalc.total_qr += mov.monto
          }
        } else if (mov.referencia_tipo === 'pago_credito') {
          if (mov.metodo_pago === 'efectivo') {
            resumenCalc.pagos_credito_efectivo += mov.monto
            resumenCalc.total_efectivo += mov.monto
          } else if (mov.metodo_pago === 'qr') {
            resumenCalc.pagos_credito_qr += mov.monto
            resumenCalc.total_qr += mov.monto
          }
        }
      } else if (mov.tipo === 'egreso') {
        if (mov.referencia_tipo === 'gasto') {
          if (mov.metodo_pago === 'efectivo') {
            resumenCalc.gastos_efectivo += mov.monto
            resumenCalc.total_efectivo -= mov.monto
          } else if (mov.metodo_pago === 'qr') {
            resumenCalc.gastos_qr += mov.monto
            resumenCalc.total_qr -= mov.monto
          }
        } else if (mov.referencia_tipo === 'compra') {
          if (mov.metodo_pago === 'efectivo') {
            resumenCalc.compras_efectivo += mov.monto
            resumenCalc.total_efectivo -= mov.monto
          } else if (mov.metodo_pago === 'qr') {
            resumenCalc.compras_qr += mov.monto
            resumenCalc.total_qr -= mov.monto
          }
        }
      } else if (mov.tipo === 'retiro') {
        resumenCalc.retiros += mov.monto
        resumenCalc.total_efectivo -= mov.monto
      }
    })
    
    resumenCalc.total_esperado = resumenCalc.total_efectivo + resumenCalc.total_qr
    
    setResumen(resumenCalc)
  }
  
  // Obtener último monto de cierre
  const fetchUltimoCierre = async () => {
    const { data } = await supabase
      .from('cajas')
      .select('monto_final')
      .eq('sucursal_id', sucursalId)
      .eq('estado', 'cerrada')
      .order('fecha_cierre', { ascending: false })
      .limit(1)
      .single()
    
    setUltimoCierre(data?.monto_final || 0)
  }
  
  // Abrir caja
  const abrirCaja = async (montoInicial: number, notas?: string): Promise<Caja | null> => {
    try {
      setError(null)
      
      // Verificar que no haya caja abierta
      if (cajaAbierta) {
        setError('Ya existe una caja abierta')
        return null
      }
      
      // Crear nueva caja
      const { data: nuevaCaja, error: cajaError } = await supabase
        .from('cajas')
        .insert({
          sucursal_id: sucursalId,
          usuario_id: usuarioId,
          monto_inicial: montoInicial,
          estado: 'abierta',
          notas
        })
        .select()
        .single()
      
      if (cajaError) throw cajaError
      
      // Registrar movimiento de apertura
      await supabase
        .from('movimientos_caja')
        .insert({
          caja_id: nuevaCaja.id,
          tipo: 'apertura',
          concepto: 'Apertura de caja',
          monto: montoInicial,
          metodo_pago: 'efectivo'
        })
      
      setCajaAbierta(nuevaCaja)
      await fetchCajaAbierta()
      
      return nuevaCaja
      
    } catch (err) {
      console.error('Error al abrir caja:', err)
      setError('Error al abrir caja')
      return null
    }
  }
  
  // Cerrar caja
  const cerrarCaja = async (montoFinal: number, notas?: string): Promise<boolean> => {
    try {
      setError(null)
      
      if (!cajaAbierta) {
        setError('No hay caja abierta')
        return false
      }
      
      // Actualizar caja
      const { error: updateError } = await supabase
        .from('cajas')
        .update({
          monto_final: montoFinal,
          fecha_cierre: new Date().toISOString(),
          estado: 'cerrada',
          notas: notas ? `${cajaAbierta.notas || ''}\nCierre: ${notas}` : cajaAbierta.notas
        })
        .eq('id', cajaAbierta.id)
      
      if (updateError) throw updateError
      
      // Registrar movimiento de cierre
      await supabase
        .from('movimientos_caja')
        .insert({
          caja_id: cajaAbierta.id,
          tipo: 'cierre',
          concepto: 'Cierre de caja',
          monto: montoFinal,
          metodo_pago: 'efectivo'
        })
      
      setCajaAbierta(null)
      setResumen(null)
      setMovimientos([])
      await fetchUltimoCierre()
      
      return true
      
    } catch (err) {
      console.error('Error al cerrar caja:', err)
      setError('Error al cerrar caja')
      return false
    }
  }
  
  // Registrar retiro de caja
  const registrarRetiro = async (monto: number, concepto: string): Promise<boolean> => {
    try {
      setError(null)
      
      if (!cajaAbierta) {
        setError('No hay caja abierta')
        return false
      }
      
      // Validar que haya suficiente efectivo
      if (resumen && monto > resumen.total_efectivo) {
        setError('Monto de retiro mayor al efectivo disponible')
        return false
      }
      
      const { error: insertError } = await supabase
        .from('movimientos_caja')
        .insert({
          caja_id: cajaAbierta.id,
          tipo: 'retiro',
          concepto,
          monto,
          metodo_pago: 'efectivo'
        })
      
      if (insertError) throw insertError
      
      await fetchCajaAbierta()
      return true
      
    } catch (err) {
      console.error('Error al registrar retiro:', err)
      setError('Error al registrar retiro')
      return false
    }
  }
  
  // Cargar al montar
  useEffect(() => {
    if (sucursalId && usuarioId) {
      fetchCajaAbierta()
    }
  }, [sucursalId, usuarioId, fetchCajaAbierta])
  
  return {
    cajaAbierta,
    loading,
    error,
    resumen,
    movimientos,
    ultimoCierre,
    abrirCaja,
    cerrarCaja,
    registrarRetiro,
    refetch: fetchCajaAbierta
  }
}