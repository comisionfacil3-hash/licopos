'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import * as XLSX from 'xlsx'
import { formatCurrency } from '@/lib/utils/format'
import { formatDateTime } from '@/lib/utils/timezone'

interface DatosDia {
  fecha: string
  ingresos: number
  costos: number
  gastos: number
  utilidad_neta: number
}

interface DatosSemana {
  semana: string
  numero: number
  ingresos: number
  costos: number
  gastos: number
  utilidad_neta: number
}

interface ResumenPeriodo {
  total_ingresos: number
  ventas_efectivo: number
  ventas_qr: number
  ventas_credito: number
  pagos_credito: number
  costo_ventas: number
  utilidad_bruta: number
  total_gastos: number
  gastos_alquiler: number
  gastos_servicios: number
  gastos_sueldos: number
  gastos_otros: number
  compras_pagadas: number
  utilidad_neta: number
  margen_bruto: number
  margen_neto: number
}

export default function EstadoResultadosPage() {
  const supabase = createClient()
  const { usuario } = useAuth()
  const [loading, setLoading] = useState(true)
  
  // Filtros
  const [rangoFecha, setRangoFecha] = useState('mes_actual')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  
  // Datos
  const [resumen, setResumen] = useState<ResumenPeriodo | null>(null)
  const [datosPorDia, setDatosPorDia] = useState<DatosDia[]>([])
  const [datosPorSemana, setDatosPorSemana] = useState<DatosSemana[]>([])
  const [comparativaPeriodoAnterior, setComparativaPeriodoAnterior] = useState<number>(0)
  
  // Vista
  const [vistaActual, setVistaActual] = useState<'dia' | 'semana'>('dia')

  useEffect(() => {
    if (usuario?.sucursal_id) {
      const hoy = new Date()
      let inicio = new Date()
      let fin = new Date()

      if (rangoFecha === 'hoy') {
        inicio = new Date(hoy.setHours(0, 0, 0, 0))
        fin = new Date(hoy.setHours(23, 59, 59, 999))
      } else if (rangoFecha === 'ayer') {
        inicio = new Date(hoy.setDate(hoy.getDate() - 1))
        inicio.setHours(0, 0, 0, 0)
        fin = new Date(inicio)
        fin.setHours(23, 59, 59, 999)
      } else if (rangoFecha === 'ultimos_7') {
        inicio = new Date(hoy.setDate(hoy.getDate() - 6))
        inicio.setHours(0, 0, 0, 0)
        fin = new Date()
      } else if (rangoFecha === 'ultimos_30') {
        inicio = new Date(hoy.setDate(hoy.getDate() - 29))
        inicio.setHours(0, 0, 0, 0)
        fin = new Date()
      } else if (rangoFecha === 'mes_actual') {
        inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
        fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999)
      } else if (rangoFecha === 'mes_anterior') {
        inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
        fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59, 999)
      }

      setFechaInicio(inicio.toISOString().split('T')[0])
      setFechaFin(fin.toISOString().split('T')[0])
    }
  }, [rangoFecha, usuario?.sucursal_id])

  useEffect(() => {
    if (usuario && fechaInicio && fechaFin) {
      loadData()
    }
  }, [usuario, fechaInicio, fechaFin])

  const loadData = async () => {
    if (!usuario) return
    setLoading(true)

    try {
      await Promise.all([
        cargarResumenPeriodo(),
        cargarDatosPorDia(),
        cargarDatosPorSemana(),
        cargarComparativaPeriodoAnterior()
      ])
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const cargarResumenPeriodo = async () => {
    if (!usuario) return

    try {
      // INGRESOS - Ventas completadas
      const { data: ventas } = await supabase
        .from('ventas')
        .select('total, metodo_pago')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('estado', 'completada')
        .gte('created_at', `${fechaInicio}T00:00:00`)
        .lte('created_at', `${fechaFin}T23:59:59`)

      const ventasEfectivo = ventas?.filter(v => v.metodo_pago === 'efectivo').reduce((sum, v) => sum + v.total, 0) || 0
      const ventasQR = ventas?.filter(v => v.metodo_pago === 'qr').reduce((sum, v) => sum + v.total, 0) || 0
      const ventasCredito = ventas?.filter(v => v.metodo_pago === 'credito').reduce((sum, v) => sum + v.total, 0) || 0
      const ventasMixto = ventas?.filter(v => v.metodo_pago === 'mixto').reduce((sum, v) => sum + v.total, 0) || 0

      // Pagos de crédito
      const { data: pagosCredito } = await supabase
        .from('pagos_credito')
        .select('monto')
        .eq('credito_id', usuario.sucursal_id)
        .gte('created_at', `${fechaInicio}T00:00:00`)
        .lte('created_at', `${fechaFin}T23:59:59`)

      const totalPagosCredito = pagosCredito?.reduce((sum, p) => sum + p.monto, 0) || 0

      const totalIngresos = ventasEfectivo + ventasQR + ventasCredito + ventasMixto + totalPagosCredito

      // COSTOS - Costo de productos vendidos
      const { data: ventaDetalles } = await supabase
        .from('venta_detalles')
        .select(`
          cantidad,
          precio_unitario,
          venta:ventas!inner(
            created_at,
            estado,
            sucursal_id
          ),
          producto:productos!inner(
            precio_compra
          )
        `)
        .eq('venta.sucursal_id', usuario.sucursal_id)
        .eq('venta.estado', 'completada')
        .gte('venta.created_at', `${fechaInicio}T00:00:00`)
        .lte('venta.created_at', `${fechaFin}T23:59:59`)

      const costoVentas = ventaDetalles?.reduce((sum, detalle: any) => {
        const costo = (detalle.producto?.precio_compra || 0) * detalle.cantidad
        return sum + costo
      }, 0) || 0

      const utilidadBruta = totalIngresos - costoVentas

      // GASTOS - Todos los gastos del período
      const { data: gastos } = await supabase
        .from('gastos')
        .select('monto, categoria')
        .eq('sucursal_id', usuario.sucursal_id)
        .gte('created_at', `${fechaInicio}T00:00:00`)
        .lte('created_at', `${fechaFin}T23:59:59`)

      let gastosAlquiler = 0
      let gastosServicios = 0
      let gastosSueldos = 0
      let gastosOtros = 0

      gastos?.forEach(g => {
        if (g.categoria === 'alquiler') gastosAlquiler += g.monto
        else if (g.categoria === 'servicios') gastosServicios += g.monto
        else if (g.categoria === 'sueldos') gastosSueldos += g.monto
        else gastosOtros += g.monto
      })

      const totalGastos = gastosAlquiler + gastosServicios + gastosSueldos + gastosOtros

      // COMPRAS pagadas en el período (egresos)
      const { data: compras } = await supabase
        .from('compras')
        .select('total')
        .eq('sucursal_id', usuario.sucursal_id)
        .gte('created_at', `${fechaInicio}T00:00:00`)
        .lte('created_at', `${fechaFin}T23:59:59`)

      const comprasPagadas = compras?.reduce((sum, c) => sum + c.total, 0) || 0

      // UTILIDAD NETA
      const utilidadNeta = utilidadBruta - totalGastos - comprasPagadas

      setResumen({
        total_ingresos: totalIngresos,
        ventas_efectivo: ventasEfectivo,
        ventas_qr: ventasQR,
        ventas_credito: ventasCredito + ventasMixto,
        pagos_credito: totalPagosCredito,
        costo_ventas: costoVentas,
        utilidad_bruta: utilidadBruta,
        total_gastos: totalGastos,
        gastos_alquiler: gastosAlquiler,
        gastos_servicios: gastosServicios,
        gastos_sueldos: gastosSueldos,
        gastos_otros: gastosOtros,
        compras_pagadas: comprasPagadas,
        utilidad_neta: utilidadNeta,
        margen_bruto: totalIngresos > 0 ? (utilidadBruta / totalIngresos) * 100 : 0,
        margen_neto: totalIngresos > 0 ? (utilidadNeta / totalIngresos) * 100 : 0
      })

    } catch (error) {
      console.error('Error cargando resumen:', error)
    }
  }

  const cargarDatosPorDia = async () => {
    if (!usuario) return

    try {
      const inicio = new Date(fechaInicio)
      const fin = new Date(fechaFin)
      const dias: DatosDia[] = []

      for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
        const fechaDia = d.toISOString().split('T')[0]

        // Ingresos del día
        const { data: ventas } = await supabase
          .from('ventas')
          .select('total')
          .eq('sucursal_id', usuario.sucursal_id)
          .eq('estado', 'completada')
          .gte('created_at', `${fechaDia}T00:00:00`)
          .lte('created_at', `${fechaDia}T23:59:59`)

        const ingresos = ventas?.reduce((sum, v) => sum + v.total, 0) || 0

        // Costos del día
        const { data: ventaDetalles } = await supabase
          .from('venta_detalles')
          .select(`
            cantidad,
            venta:ventas!inner(created_at, estado, sucursal_id),
            producto:productos!inner(precio_compra)
          `)
          .eq('venta.sucursal_id', usuario.sucursal_id)
          .eq('venta.estado', 'completada')
          .gte('venta.created_at', `${fechaDia}T00:00:00`)
          .lte('venta.created_at', `${fechaDia}T23:59:59`)

        const costos = ventaDetalles?.reduce((sum, d: any) => sum + ((d.producto?.precio_compra || 0) * d.cantidad), 0) || 0

        // Gastos del día
        const { data: gastos } = await supabase
          .from('gastos')
          .select('monto')
          .eq('sucursal_id', usuario.sucursal_id)
          .gte('created_at', `${fechaDia}T00:00:00`)
          .lte('created_at', `${fechaDia}T23:59:59`)

        const gastosTotal = gastos?.reduce((sum, g) => sum + g.monto, 0) || 0

        // Compras del día
        const { data: compras } = await supabase
          .from('compras')
          .select('total')
          .eq('sucursal_id', usuario.sucursal_id)
          .gte('created_at', `${fechaDia}T00:00:00`)
          .lte('created_at', `${fechaDia}T23:59:59`)

        const comprasTotal = compras?.reduce((sum, c) => sum + c.total, 0) || 0

        const utilidadNeta = ingresos - costos - gastosTotal - comprasTotal

        dias.push({
          fecha: fechaDia,
          ingresos,
          costos,
          gastos: gastosTotal + comprasTotal,
          utilidad_neta: utilidadNeta
        })
      }

      setDatosPorDia(dias)
    } catch (error) {
      console.error('Error cargando datos por día:', error)
    }
  }

  const cargarDatosPorSemana = async () => {
    if (!usuario) return

    try {
      const semanas: DatosSemana[] = []
      let semanaNum = 1

      const inicio = new Date(fechaInicio)
      const fin = new Date(fechaFin)

      let inicioSemana = new Date(inicio)

      while (inicioSemana <= fin) {
        const finSemana = new Date(inicioSemana)
        finSemana.setDate(finSemana.getDate() + 6)

        const fechaInicioStr = inicioSemana.toISOString().split('T')[0]
        const fechaFinStr = (finSemana > fin ? fin : finSemana).toISOString().split('T')[0]

        // Ingresos de la semana
        const { data: ventas } = await supabase
          .from('ventas')
          .select('total')
          .eq('sucursal_id', usuario.sucursal_id)
          .eq('estado', 'completada')
          .gte('created_at', `${fechaInicioStr}T00:00:00`)
          .lte('created_at', `${fechaFinStr}T23:59:59`)

        const ingresos = ventas?.reduce((sum, v) => sum + v.total, 0) || 0

        // Costos de la semana
        const { data: ventaDetalles } = await supabase
          .from('venta_detalles')
          .select(`
            cantidad,
            venta:ventas!inner(created_at, estado, sucursal_id),
            producto:productos!inner(precio_compra)
          `)
          .eq('venta.sucursal_id', usuario.sucursal_id)
          .eq('venta.estado', 'completada')
          .gte('venta.created_at', `${fechaInicioStr}T00:00:00`)
          .lte('venta.created_at', `${fechaFinStr}T23:59:59`)

        const costos = ventaDetalles?.reduce((sum, d: any) => sum + ((d.producto?.precio_compra || 0) * d.cantidad), 0) || 0

        // Gastos de la semana
        const { data: gastos } = await supabase
          .from('gastos')
          .select('monto')
          .eq('sucursal_id', usuario.sucursal_id)
          .gte('created_at', `${fechaInicioStr}T00:00:00`)
          .lte('created_at', `${fechaFinStr}T23:59:59`)

        const gastosTotal = gastos?.reduce((sum, g) => sum + g.monto, 0) || 0

        // Compras de la semana
        const { data: compras } = await supabase
          .from('compras')
          .select('total')
          .eq('sucursal_id', usuario.sucursal_id)
          .gte('created_at', `${fechaInicioStr}T00:00:00`)
          .lte('created_at', `${fechaFinStr}T23:59:59`)

        const comprasTotal = compras?.reduce((sum, c) => sum + c.total, 0) || 0

        const utilidadNeta = ingresos - costos - gastosTotal - comprasTotal

        semanas.push({
          semana: `Semana ${semanaNum}`,
          numero: semanaNum,
          ingresos,
          costos,
          gastos: gastosTotal + comprasTotal,
          utilidad_neta: utilidadNeta
        })

        semanaNum++
        inicioSemana = new Date(finSemana)
        inicioSemana.setDate(inicioSemana.getDate() + 1)
      }

      setDatosPorSemana(semanas)
    } catch (error) {
      console.error('Error cargando datos por semana:', error)
    }
  }

  const cargarComparativaPeriodoAnterior = async () => {
    if (!usuario) return

    try {
      const inicio = new Date(fechaInicio)
      const fin = new Date(fechaFin)
      const dias = Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1

      const inicioAnterior = new Date(inicio)
      inicioAnterior.setDate(inicioAnterior.getDate() - dias)
      const finAnterior = new Date(inicio)
      finAnterior.setDate(finAnterior.getDate() - 1)

      const fechaInicioAnt = inicioAnterior.toISOString().split('T')[0]
      const fechaFinAnt = finAnterior.toISOString().split('T')[0]

      // Ingresos período anterior
      const { data: ventasAnt } = await supabase
        .from('ventas')
        .select('total')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('estado', 'completada')
        .gte('created_at', `${fechaInicioAnt}T00:00:00`)
        .lte('created_at', `${fechaFinAnt}T23:59:59`)

      const ingresosAnt = ventasAnt?.reduce((sum, v) => sum + v.total, 0) || 0

      // Costos período anterior
      const { data: detallesAnt } = await supabase
        .from('venta_detalles')
        .select(`
          cantidad,
          venta:ventas!inner(created_at, estado, sucursal_id),
          producto:productos!inner(precio_compra)
        `)
        .eq('venta.sucursal_id', usuario.sucursal_id)
        .eq('venta.estado', 'completada')
        .gte('venta.created_at', `${fechaInicioAnt}T00:00:00`)
        .lte('venta.created_at', `${fechaFinAnt}T23:59:59`)

      const costosAnt = detallesAnt?.reduce((sum, d: any) => sum + ((d.producto?.precio_compra || 0) * d.cantidad), 0) || 0

      // Gastos período anterior
      const { data: gastosAnt } = await supabase
        .from('gastos')
        .select('monto')
        .eq('sucursal_id', usuario.sucursal_id)
        .gte('created_at', `${fechaInicioAnt}T00:00:00`)
        .lte('created_at', `${fechaFinAnt}T23:59:59`)

      const gastosTotalAnt = gastosAnt?.reduce((sum, g) => sum + g.monto, 0) || 0

      // Compras período anterior
      const { data: comprasAnt } = await supabase
        .from('compras')
        .select('total')
        .eq('sucursal_id', usuario.sucursal_id)
        .gte('created_at', `${fechaInicioAnt}T00:00:00`)
        .lte('created_at', `${fechaFinAnt}T23:59:59`)

      const comprasTotalAnt = comprasAnt?.reduce((sum, c) => sum + c.total, 0) || 0

      const utilidadNetaAnt = ingresosAnt - costosAnt - gastosTotalAnt - comprasTotalAnt

      if (resumen && utilidadNetaAnt > 0) {
        const cambio = ((resumen.utilidad_neta - utilidadNetaAnt) / utilidadNetaAnt) * 100
        setComparativaPeriodoAnterior(cambio)
      } else {
        setComparativaPeriodoAnterior(0)
      }

    } catch (error) {
      console.error('Error cargando comparativa:', error)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })
  }

  const exportarExcel = () => {
    if (!resumen) return

    const datosResumen = [{
      'CONCEPTO': 'TOTAL INGRESOS',
      'MONTO': resumen.total_ingresos
    }, {
      'CONCEPTO': '- Ventas Efectivo',
      'MONTO': resumen.ventas_efectivo
    }, {
      'CONCEPTO': '- Ventas QR',
      'MONTO': resumen.ventas_qr
    }, {
      'CONCEPTO': '- Ventas Crédito',
      'MONTO': resumen.ventas_credito
    }, {
      'CONCEPTO': '- Pagos de Crédito',
      'MONTO': resumen.pagos_credito
    }, {
      'CONCEPTO': '',
      'MONTO': ''
    }, {
      'CONCEPTO': 'COSTO DE VENTAS',
      'MONTO': resumen.costo_ventas
    }, {
      'CONCEPTO': '',
      'MONTO': ''
    }, {
      'CONCEPTO': 'UTILIDAD BRUTA',
      'MONTO': resumen.utilidad_bruta
    }, {
      'CONCEPTO': 'Margen Bruto %',
      'MONTO': resumen.margen_bruto.toFixed(1) + '%'
    }, {
      'CONCEPTO': '',
      'MONTO': ''
    }, {
      'CONCEPTO': 'GASTOS OPERATIVOS',
      'MONTO': resumen.total_gastos + resumen.compras_pagadas
    }, {
      'CONCEPTO': '- Alquiler',
      'MONTO': resumen.gastos_alquiler
    }, {
      'CONCEPTO': '- Servicios',
      'MONTO': resumen.gastos_servicios
    }, {
      'CONCEPTO': '- Sueldos',
      'MONTO': resumen.gastos_sueldos
    }, {
      'CONCEPTO': '- Otros Gastos',
      'MONTO': resumen.gastos_otros
    }, {
      'CONCEPTO': '- Compras',
      'MONTO': resumen.compras_pagadas
    }, {
      'CONCEPTO': '',
      'MONTO': ''
    }, {
      'CONCEPTO': 'UTILIDAD NETA',
      'MONTO': resumen.utilidad_neta
    }, {
      'CONCEPTO': 'Margen Neto %',
      'MONTO': resumen.margen_neto.toFixed(1) + '%'
    }]

    const datosDiarios = datosPorDia.map(d => ({
      'Fecha': formatDate(d.fecha),
      'Ingresos': d.ingresos,
      'Costos': d.costos,
      'Gastos': d.gastos,
      'Utilidad Neta': d.utilidad_neta
    }))

    const datosSemanales = datosPorSemana.map(s => ({
      'Semana': s.semana,
      'Ingresos': s.ingresos,
      'Costos': s.costos,
      'Gastos': s.gastos,
      'Utilidad Neta': s.utilidad_neta
    }))

    const wb = XLSX.utils.book_new()
    
    const ws1 = XLSX.utils.json_to_sheet(datosResumen)
    XLSX.utils.book_append_sheet(wb, ws1, 'Resumen')
    
    const ws2 = XLSX.utils.json_to_sheet(datosDiarios)
    XLSX.utils.book_append_sheet(wb, ws2, 'Por Día')
    
    const ws3 = XLSX.utils.json_to_sheet(datosSemanales)
    XLSX.utils.book_append_sheet(wb, ws3, 'Por Semana')
    
    XLSX.writeFile(wb, `Estado_Resultados_${fechaInicio}_${fechaFin}.xlsx`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando estado de resultados...</p>
        </div>
      </div>
    )
  }

  if (!resumen) {
    return (
      <div className="p-4 text-center text-gray-500">
        No hay datos disponibles para el período seleccionado
      </div>
    )
  }

  return (
    <div className="p-4 pb-24 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estado de Resultados</h1>
          <p className="text-gray-500 text-sm">Ganancias Netas Detalladas</p>
        </div>
        <button
          onClick={exportarExcel}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Exportar Excel
        </button>
      </div>

      {/* Filtros de Fecha */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {[
            { valor: 'hoy', label: 'Hoy' },
            { valor: 'ayer', label: 'Ayer' },
            { valor: 'ultimos_7', label: 'Últimos 7 días' },
            { valor: 'ultimos_30', label: 'Últimos 30 días' },
            { valor: 'mes_actual', label: 'Este Mes' },
            { valor: 'mes_anterior', label: 'Mes Anterior' }
          ].map(filtro => (
            <button
              key={filtro.valor}
              onClick={() => setRangoFecha(filtro.valor)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                rangoFecha === filtro.valor
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filtro.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Ingresos */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">Total Ingresos</h3>
            <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-3xl font-bold mb-1">{formatCurrency(resumen.total_ingresos)}</p>
          <p className="text-sm opacity-80">Ventas + Pagos Crédito</p>
        </div>

        {/* Utilidad Bruta */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">Utilidad Bruta</h3>
            <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-3xl font-bold mb-1">{formatCurrency(resumen.utilidad_bruta)}</p>
          <p className="text-sm opacity-80">Margen: {resumen.margen_bruto.toFixed(1)}%</p>
        </div>

        {/* Total Gastos */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">Total Gastos</h3>
            <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-3xl font-bold mb-1">{formatCurrency(resumen.total_gastos + resumen.compras_pagadas)}</p>
          <p className="text-sm opacity-80">Operativos + Compras</p>
        </div>

        {/* Utilidad Neta */}
        <div className={`bg-gradient-to-br ${resumen.utilidad_neta >= 0 ? 'from-emerald-500 to-emerald-600' : 'from-red-500 to-red-600'} rounded-xl shadow-lg p-6 text-white`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">Utilidad Neta</h3>
            <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-3xl font-bold mb-1">{formatCurrency(resumen.utilidad_neta)}</p>
          <div className="flex items-center gap-2">
            <p className="text-sm opacity-80">Margen: {resumen.margen_neto.toFixed(1)}%</p>
            {comparativaPeriodoAnterior !== 0 && (
              <span className={`text-xs px-2 py-1 rounded-full ${comparativaPeriodoAnterior > 0 ? 'bg-white/20' : 'bg-black/20'}`}>
                {comparativaPeriodoAnterior > 0 ? '↑' : '↓'} {Math.abs(comparativaPeriodoAnterior).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Desglose de Ingresos y Gastos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Desglose Ingresos */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <div className="w-2 h-8 bg-blue-500 rounded"></div>
            Desglose de Ingresos
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-gray-600">Ventas Efectivo</span>
              <span className="font-semibold">{formatCurrency(resumen.ventas_efectivo)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-gray-600">Ventas QR</span>
              <span className="font-semibold">{formatCurrency(resumen.ventas_qr)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-gray-600">Ventas Crédito/Mixto</span>
              <span className="font-semibold">{formatCurrency(resumen.ventas_credito)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-gray-600">Pagos de Crédito</span>
              <span className="font-semibold">{formatCurrency(resumen.pagos_credito)}</span>
            </div>
            <div className="flex items-center justify-between py-3 bg-blue-50 rounded-lg px-4">
              <span className="font-bold text-gray-900">TOTAL INGRESOS</span>
              <span className="font-bold text-blue-600 text-lg">{formatCurrency(resumen.total_ingresos)}</span>
            </div>
          </div>
        </div>

        {/* Desglose Gastos */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <div className="w-2 h-8 bg-orange-500 rounded"></div>
            Desglose de Gastos
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-gray-600">🏢 Alquiler</span>
              <span className="font-semibold">{formatCurrency(resumen.gastos_alquiler)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-gray-600">🔌 Servicios</span>
              <span className="font-semibold">{formatCurrency(resumen.gastos_servicios)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-gray-600">💰 Sueldos</span>
              <span className="font-semibold">{formatCurrency(resumen.gastos_sueldos)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-gray-600">💼 Otros Gastos</span>
              <span className="font-semibold">{formatCurrency(resumen.gastos_otros)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-gray-600">🛍️ Compras</span>
              <span className="font-semibold">{formatCurrency(resumen.compras_pagadas)}</span>
            </div>
            <div className="flex items-center justify-between py-3 bg-orange-50 rounded-lg px-4">
              <span className="font-bold text-gray-900">TOTAL GASTOS</span>
              <span className="font-bold text-orange-600 text-lg">{formatCurrency(resumen.total_gastos + resumen.compras_pagadas)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Resumen Estado de Resultados */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <div className="w-2 h-8 bg-emerald-500 rounded"></div>
          Estado de Resultados Resumido
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-3 border-b border-gray-200">
            <span className="font-semibold text-gray-700">Ingresos Totales</span>
            <span className="font-bold text-lg">{formatCurrency(resumen.total_ingresos)}</span>
          </div>
          <div className="flex items-center justify-between py-2 pl-4">
            <span className="text-gray-600">(-) Costo de Ventas</span>
            <span className="text-red-600">-{formatCurrency(resumen.costo_ventas)}</span>
          </div>
          <div className="flex items-center justify-between py-3 bg-purple-50 rounded-lg px-4">
            <span className="font-semibold text-gray-900">(=) Utilidad Bruta</span>
            <span className="font-bold text-purple-600">{formatCurrency(resumen.utilidad_bruta)}</span>
          </div>
          <div className="flex items-center justify-between py-2 pl-4">
            <span className="text-gray-600">(-) Gastos Operativos</span>
            <span className="text-red-600">-{formatCurrency(resumen.total_gastos)}</span>
          </div>
          <div className="flex items-center justify-between py-2 pl-4">
            <span className="text-gray-600">(-) Compras Pagadas</span>
            <span className="text-red-600">-{formatCurrency(resumen.compras_pagadas)}</span>
          </div>
          <div className={`flex items-center justify-between py-4 rounded-lg px-4 ${resumen.utilidad_neta >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
            <span className="font-bold text-gray-900 text-lg">(=) UTILIDAD NETA</span>
            <span className={`font-bold text-2xl ${resumen.utilidad_neta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(resumen.utilidad_neta)}
            </span>
          </div>
        </div>
      </div>

      {/* Toggle Vista Día/Semana */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setVistaActual('dia')}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              vistaActual === 'dia'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Por Día
          </button>
          <button
            onClick={() => setVistaActual('semana')}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              vistaActual === 'semana'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Por Semana
          </button>
        </div>
      </div>

      {/* Gráfica de Tendencia */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          {vistaActual === 'dia' ? 'Tendencia Diaria' : 'Tendencia Semanal'}
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          {vistaActual === 'dia' ? (
            <LineChart data={datosPorDia}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="fecha" 
                tickFormatter={(value) => formatDate(value)}
              />
              <YAxis />
              <Tooltip 
                formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value) : ''}
                labelFormatter={(label) => formatDate(label)}
              />
              <Legend />
              <Line type="monotone" dataKey="ingresos" stroke="#3b82f6" name="Ingresos" strokeWidth={2} />
              <Line type="monotone" dataKey="costos" stroke="#ef4444" name="Costos" strokeWidth={2} />
              <Line type="monotone" dataKey="gastos" stroke="#f97316" name="Gastos" strokeWidth={2} />
              <Line type="monotone" dataKey="utilidad_neta" stroke="#10b981" name="Utilidad Neta" strokeWidth={3} />
            </LineChart>
          ) : (
            <BarChart data={datosPorSemana}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="semana" />
              <YAxis />
              <Tooltip formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value) : ''} />
              <Legend />
              <Bar dataKey="ingresos" fill="#3b82f6" name="Ingresos" />
              <Bar dataKey="costos" fill="#ef4444" name="Costos" />
              <Bar dataKey="gastos" fill="#f97316" name="Gastos" />
              <Bar dataKey="utilidad_neta" fill="#10b981" name="Utilidad Neta" />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Tabla Detallada */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="text-lg font-bold text-gray-900">
            Detalle {vistaActual === 'dia' ? 'Diario' : 'Semanal'}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {vistaActual === 'dia' ? 'Fecha' : 'Semana'}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ingresos
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Costos
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gastos
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilidad Neta
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {vistaActual === 'dia' ? (
                datosPorDia.map((dia, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatDate(dia.fecha)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-600">
                      {formatCurrency(dia.ingresos)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">
                      {formatCurrency(dia.costos)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-orange-600">
                      {formatCurrency(dia.gastos)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${
                      dia.utilidad_neta >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(dia.utilidad_neta)}
                    </td>
                  </tr>
                ))
              ) : (
                datosPorSemana.map((semana, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {semana.semana}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-600">
                      {formatCurrency(semana.ingresos)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">
                      {formatCurrency(semana.costos)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-orange-600">
                      {formatCurrency(semana.gastos)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${
                      semana.utilidad_neta >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(semana.utilidad_neta)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Box Educativa */}
      <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="font-bold text-emerald-900 mb-2">💡 Cómo interpretar este reporte</h4>
            <div className="text-sm text-emerald-800 space-y-2">
              <p><strong>Utilidad Bruta:</strong> Es la ganancia antes de pagar gastos fijos (alquiler, sueldos, etc.). Muestra si tus precios de venta son buenos.</p>
              <p><strong>Utilidad Neta:</strong> Es la GANANCIA REAL después de pagar TODOS los gastos. Este es el dinero que realmente ganaste.</p>
              <p><strong>Margen Neto:</strong> Si es mayor al 10% está bien. Mayor al 20% es excelente.</p>
              <p><strong>Días/Semanas con pérdida (rojo):</strong> Normal que haya algunos días bajos. Lo importante es que el mes completo sea positivo.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}