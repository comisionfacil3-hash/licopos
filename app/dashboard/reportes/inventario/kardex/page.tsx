// Path: app\dashboard\reportes\inventario\kardex\page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { formatCurrency } from '@/lib/utils/format'
import { formatDateTime } from '@/lib/utils/timezone'
import * as XLSX from 'xlsx'
import { ArrowLeft, Package, TrendingUp, TrendingDown, FileText } from 'lucide-react'

interface Producto {
  id: string
  nombre: string
  codigo: string
  stock_actual: number
  precio_compra: number
  precio_venta: number
  categoria_nombre: string
}

interface MovimientoKardex {
  fecha: string
  tipo: string
  documento: string
  referencia_id: string
  entrada: number
  salida: number
  saldo: number
  detalles: string
  costo_unitario: number
}

export default function KardexPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null)
  const [movimientos, setMovimientos] = useState<MovimientoKardex[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMovimientos, setLoadingMovimientos] = useState(false)
  const [exportando, setExportando] = useState(false)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (usuario?.sucursal_id) {
      loadProductos()
      // Establecer fechas por defecto (último mes)
      const hoy = new Date()
      const haceUnMes = new Date()
      haceUnMes.setMonth(haceUnMes.getMonth() - 1)
      
      setFechaFin(hoy.toISOString().split('T')[0])
      setFechaInicio(haceUnMes.toISOString().split('T')[0])
    }
  }, [usuario?.sucursal_id])

  const loadProductos = async () => {
    if (!usuario?.sucursal_id) return

    setLoading(true)
    try {
      const { data: productosData } = await supabase
        .from('productos')
        .select(`
          id,
          nombre,
          codigo,
          stock_actual,
          precio_compra,
          precio_venta,
          categoria_id
        `)
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('activo', true)
        .order('nombre')

      if (productosData) {
        // Cargar categorías
        const categoriaIds = [...new Set(productosData.map(p => p.categoria_id))]
        const { data: categoriasData } = await supabase
          .from('categorias')
          .select('id, nombre')
          .in('id', categoriaIds)

        const categoriasMap: Record<string, string> = {}
        if (categoriasData) {
          categoriasData.forEach(c => {
            categoriasMap[c.id] = c.nombre
          })
        }

        const productosConCategoria = productosData.map(p => ({
          ...p,
          categoria_nombre: categoriasMap[p.categoria_id] || 'Sin categoría'
        }))

        setProductos(productosConCategoria)
      }
    } catch (err) {
      console.error('Error cargando productos:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadKardex = async (producto: Producto) => {
    if (!usuario?.sucursal_id || !fechaInicio || !fechaFin) return

    setLoadingMovimientos(true)
    setProductoSeleccionado(producto)
    
    try {
      const movimientos: MovimientoKardex[] = []
      
      // Parsear fechas correctamente en zona horaria local
      const [yearInicio, monthInicio, dayInicio] = fechaInicio.split('-').map(Number)
      const fechaInicioDate = new Date(yearInicio, monthInicio - 1, dayInicio, 0, 0, 0, 0)
      
      const [yearFin, monthFin, dayFin] = fechaFin.split('-').map(Number)
      const fechaFinDate = new Date(yearFin, monthFin - 1, dayFin, 23, 59, 59, 999)

      // 1. COMPRAS (entradas)
      const { data: comprasData } = await supabase
        .from('compra_detalles')
        .select(`
          cantidad,
          precio_unitario,
          created_at,
          compras!inner(
            id,
            numero_compra,
            created_at,
            sucursal_id
          )
        `)
        .eq('producto_id', producto.id)
        .eq('compras.sucursal_id', usuario.sucursal_id)
        .gte('created_at', fechaInicioDate.toISOString())
        .lte('created_at', fechaFinDate.toISOString())
        .order('created_at')

      if (comprasData) {
        comprasData.forEach((item: any) => {
          movimientos.push({
            fecha: item.created_at,
            tipo: 'Compra',
            documento: `Compra #${item.compras.numero_compra}`,
            referencia_id: item.compras.id,
            entrada: item.cantidad,
            salida: 0,
            saldo: 0,
            detalles: `Ingreso por compra`,
            costo_unitario: item.precio_unitario
          })
        })
      }

      // 2. VENTAS (salidas)
      const { data: ventasData } = await supabase
        .from('venta_detalles')
        .select(`
          cantidad,
          precio_unitario,
          costo_unitario,
          created_at,
          ventas!inner(
            id,
            numero_venta,
            created_at,
            sucursal_id,
            estado
          )
        `)
        .eq('producto_id', producto.id)
        .eq('ventas.sucursal_id', usuario.sucursal_id)
        .eq('ventas.estado', 'completada')
        .gte('created_at', fechaInicioDate.toISOString())
        .lte('created_at', fechaFinDate.toISOString())
        .order('created_at')

      if (ventasData) {
        ventasData.forEach((item: any) => {
          movimientos.push({
            fecha: item.created_at,
            tipo: 'Venta',
            documento: `Venta #${item.ventas.numero_venta}`,
            referencia_id: item.ventas.id,
            entrada: 0,
            salida: item.cantidad,
            saldo: 0,
            detalles: `Salida por venta`,
            costo_unitario: item.costo_unitario || producto.precio_compra
          })
        })
      }

      // 3. TRASPASOS ENVIADOS (salidas)
      const { data: traspasosEnviadosData } = await supabase
        .from('traspaso_detalles')
        .select(`
          cantidad,
          created_at,
          traspasos!inner(
            id,
            numero_traspaso,
            sucursal_origen_id,
            sucursal_destino_id,
            created_at,
            estado
          )
        `)
        .eq('producto_id', producto.id)
        .eq('traspasos.sucursal_origen_id', usuario.sucursal_id)
        .in('traspasos.estado', ['en_transito', 'completado'])
        .gte('created_at', fechaInicioDate.toISOString())
        .lte('created_at', fechaFinDate.toISOString())
        .order('created_at')

      if (traspasosEnviadosData) {
        for (const item of traspasosEnviadosData) {
          const traspaso = (item as any).traspasos
          
          // Obtener nombre de sucursal destino
          const { data: sucursalDestino } = await supabase
            .from('sucursales')
            .select('nombre')
            .eq('id', traspaso.sucursal_destino_id)
            .single()

          movimientos.push({
            fecha: item.created_at,
            tipo: 'Traspaso Env.',
            documento: `Traspaso #${traspaso.numero_traspaso}`,
            referencia_id: traspaso.id,
            entrada: 0,
            salida: item.cantidad,
            saldo: 0,
            detalles: `Enviado a ${sucursalDestino?.nombre || 'N/A'}`,
            costo_unitario: producto.precio_compra
          })
        }
      }

      // 4. TRASPASOS RECIBIDOS (entradas)
      const { data: traspasosRecibidosData } = await supabase
        .from('traspaso_detalles')
        .select(`
          cantidad,
          created_at,
          traspasos!inner(
            id,
            numero_traspaso,
            sucursal_origen_id,
            sucursal_destino_id,
            created_at,
            estado
          )
        `)
        .eq('producto_id', producto.id)
        .eq('traspasos.sucursal_destino_id', usuario.sucursal_id)
        .eq('traspasos.estado', 'completado')
        .gte('created_at', fechaInicioDate.toISOString())
        .lte('created_at', fechaFinDate.toISOString())
        .order('created_at')

      if (traspasosRecibidosData) {
        for (const item of traspasosRecibidosData) {
          const traspaso = (item as any).traspasos
          
          // Obtener nombre de sucursal origen
          const { data: sucursalOrigen } = await supabase
            .from('sucursales')
            .select('nombre')
            .eq('id', traspaso.sucursal_origen_id)
            .single()

          movimientos.push({
            fecha: item.created_at,
            tipo: 'Traspaso Rec.',
            documento: `Traspaso #${traspaso.numero_traspaso}`,
            referencia_id: traspaso.id,
            entrada: item.cantidad,
            salida: 0,
            saldo: 0,
            detalles: `Recibido de ${sucursalOrigen?.nombre || 'N/A'}`,
            costo_unitario: producto.precio_compra
          })
        }
      }

      // 5. AJUSTES DE INVENTARIO
      const { data: ajustesData } = await supabase
        .from('inventario_detalles')
        .select(`
          stock_sistema,
          stock_contado,
          diferencia,
          created_at,
          inventarios!inner(
            id,
            fecha_cierre,
            sucursal_id,
            estado
          )
        `)
        .eq('producto_id', producto.id)
        .eq('inventarios.sucursal_id', usuario.sucursal_id)
        .eq('inventarios.estado', 'completado')
        .gte('created_at', fechaInicioDate.toISOString())
        .lte('created_at', fechaFinDate.toISOString())
        .order('created_at')

      if (ajustesData) {
        ajustesData.forEach((item: any) => {
          if (item.diferencia !== 0) {
            movimientos.push({
              fecha: item.created_at,
              tipo: 'Ajuste Inv.',
              documento: 'Inventario',
              referencia_id: item.inventarios.id,
              entrada: item.diferencia > 0 ? item.diferencia : 0,
              salida: item.diferencia < 0 ? Math.abs(item.diferencia) : 0,
              saldo: 0,
              detalles: `Ajuste: ${item.stock_sistema} → ${item.stock_contado}`,
              costo_unitario: producto.precio_compra
            })
          }
        })
      }

      // 6. PÉRDIDAS (salidas)
      const { data: perdidasData } = await supabase
        .from('perdidas')
        .select('*')
        .eq('producto_id', producto.id)
        .eq('sucursal_id', usuario.sucursal_id)
        .gte('created_at', fechaInicioDate.toISOString())
        .lte('created_at', fechaFinDate.toISOString())
        .order('created_at')

      if (perdidasData) {
        perdidasData.forEach((item: any) => {
          movimientos.push({
            fecha: item.created_at,
            tipo: 'Pérdida',
            documento: 'Baja',
            referencia_id: item.id,
            entrada: 0,
            salida: item.cantidad,
            saldo: 0,
            detalles: item.motivo || 'Baja de inventario',
            costo_unitario: producto.precio_compra
          })
        })
      }

      // Ordenar todos los movimientos por fecha
      movimientos.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

      // CALCULAR SALDO INICIAL
      // Saldo Inicial = Stock Actual - (Entradas - Salidas) en el período
      const totalEntradasPeriodo = movimientos.reduce((sum, m) => sum + m.entrada, 0)
      const totalSalidasPeriodo = movimientos.reduce((sum, m) => sum + m.salida, 0)
      const saldoInicial = producto.stock_actual - totalEntradasPeriodo + totalSalidasPeriodo

      // Agregar fila de saldo inicial al principio (solo si hay movimientos o saldo inicial diferente de 0)
      if (movimientos.length > 0 || saldoInicial !== 0) {
        movimientos.unshift({
          fecha: fechaInicioDate.toISOString(),
          tipo: 'Saldo Inicial',
          documento: '---',
          referencia_id: '',
          entrada: 0,
          salida: 0,
          saldo: saldoInicial,
          detalles: 'Stock al inicio del período',
          costo_unitario: producto.precio_compra
        })
      }

      // Calcular saldos acumulados desde el saldo inicial
      let saldoAcumulado = saldoInicial
      movimientos.forEach((mov, index) => {
        if (index === 0) {
          // Primera fila ya tiene el saldo inicial
          return
        }
        saldoAcumulado += mov.entrada - mov.salida
        mov.saldo = saldoAcumulado
      })

      setMovimientos(movimientos)
    } catch (err) {
      console.error('Error cargando kardex:', err)
    } finally {
      setLoadingMovimientos(false)
    }
  }

  // Filtrar productos
  const productosFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return productos

    const termino = searchTerm.toLowerCase()
    return productos.filter(p =>
      p.nombre.toLowerCase().includes(termino) ||
      p.codigo?.toLowerCase().includes(termino) ||
      p.categoria_nombre.toLowerCase().includes(termino)
    )
  }, [productos, searchTerm])

  // Calcular totales (excluyendo saldo inicial)
  const totales = useMemo(() => {
    const movimientosSinSaldoInicial = movimientos.filter(m => m.tipo !== 'Saldo Inicial')
    return {
      entradas: movimientosSinSaldoInicial.reduce((sum, m) => sum + m.entrada, 0),
      salidas: movimientosSinSaldoInicial.reduce((sum, m) => sum + m.salida, 0),
      saldoFinal: movimientos.length > 0 ? movimientos[movimientos.length - 1].saldo : 0
    }
  }, [movimientos])

  // Exportar a Excel
  const exportarExcel = () => {
    if (!productoSeleccionado || movimientos.length === 0) return

    setExportando(true)
    try {
      const data = movimientos.map(m => ({
        'Fecha': formatDateTime(m.fecha),
        'Tipo': m.tipo,
        'Documento': m.documento,
        'Entrada': m.entrada,
        'Salida': m.salida,
        'Saldo': m.saldo,
        'Costo Unit.': m.costo_unitario,
        'Valor': m.costo_unitario * (m.entrada + m.salida),
        'Detalles': m.detalles
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(data)
      
      // Agregar información del producto al inicio
      XLSX.utils.sheet_add_aoa(ws, [
        [`KARDEX DE PRODUCTO`],
        [`Producto: ${productoSeleccionado.nombre}`],
        [`Código: ${productoSeleccionado.codigo}`],
        [`Período: ${fechaInicio} al ${fechaFin}`],
        [`Stock Actual: ${productoSeleccionado.stock_actual} unidades`],
        [],
      ], { origin: 'A1' })

      XLSX.utils.book_append_sheet(wb, ws, 'Kardex')
      XLSX.writeFile(wb, `kardex-${productoSeleccionado.codigo}-${new Date().getTime()}.xlsx`)
    } catch (err) {
      console.error('Error exportando:', err)
    } finally {
      setExportando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando productos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => router.push('/dashboard/reportes')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📦 Kardex de Producto</h1>
              <p className="text-sm text-gray-600">Historial completo de movimientos</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-7xl mx-auto space-y-4">
        {/* Filtros */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          {/* Buscador de productos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Buscar Producto</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nombre, código o categoría..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
            />
          </div>

          {/* Filtro de fechas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Lista de productos */}
        {!productoSeleccionado && (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Selecciona un producto</h2>
              <p className="text-sm text-gray-500">
                {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? 's' : ''} encontrado{productosFiltrados.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
              {productosFiltrados.map(producto => (
                <button
                  key={producto.id}
                  onClick={() => loadKardex(producto)}
                  className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{producto.nombre}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500">Código: {producto.codigo}</span>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                          {producto.categoria_nombre}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Stock actual</p>
                      <p className="text-lg font-bold text-gray-900">{producto.stock_actual}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Kardex del producto seleccionado */}
        {productoSeleccionado && (
          <div className="space-y-4">
            {/* Cabecera del producto */}
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-6 text-white">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">{productoSeleccionado.nombre}</h2>
                  <div className="flex items-center gap-4 text-sm opacity-90">
                    <span>📦 Código: {productoSeleccionado.codigo}</span>
                    <span>📂 {productoSeleccionado.categoria_nombre}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setProductoSeleccionado(null)
                    setMovimientos([])
                  }}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  Cambiar producto
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white/10 rounded-lg p-3">
                  <p className="text-xs opacity-75">Stock Actual</p>
                  <p className="text-2xl font-bold">{productoSeleccionado.stock_actual}</p>
                </div>
                <div className="bg-white/10 rounded-lg p-3">
                  <p className="text-xs opacity-75">Precio Compra</p>
                  <p className="text-lg font-bold">{formatCurrency(productoSeleccionado.precio_compra)}</p>
                </div>
                <div className="bg-white/10 rounded-lg p-3">
                  <p className="text-xs opacity-75">Precio Venta</p>
                  <p className="text-lg font-bold">{formatCurrency(productoSeleccionado.precio_venta)}</p>
                </div>
                <div className="bg-white/10 rounded-lg p-3">
                  <p className="text-xs opacity-75">Margen</p>
                  <p className="text-lg font-bold">
                    {((productoSeleccionado.precio_venta - productoSeleccionado.precio_compra) / productoSeleccionado.precio_compra * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Botón exportar */}
            {movimientos.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={exportarExcel}
                  disabled={exportando}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {exportando ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Exportando...
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5" />
                      Exportar Excel
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Tabla de movimientos */}
            {loadingMovimientos ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500">Cargando movimientos...</p>
              </div>
            ) : movimientos.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Sin movimientos</h3>
                <p className="text-gray-500">
                  No hay movimientos registrados en el período seleccionado
                </p>
              </div>
            ) : (
              <>
                {/* Resumen de totales */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total Entradas</p>
                        <p className="text-xl font-bold text-emerald-600">{totales.entradas}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                        <TrendingDown className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total Salidas</p>
                        <p className="text-xl font-bold text-red-600">{totales.salidas}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Movimiento Neto</p>
                        <p className="text-xl font-bold text-purple-600">
                          {totales.entradas - totales.salidas > 0 ? '+' : ''}
                          {totales.entradas - totales.salidas}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabla responsive */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Vista desktop */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Documento</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Entrada</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Salida</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Detalles</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {movimientos.map((mov, idx) => (
                          <tr key={idx} className={`${mov.tipo === 'Saldo Inicial' ? 'bg-blue-50 font-medium' : 'hover:bg-gray-50'}`}>
                            <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                              {mov.tipo === 'Saldo Inicial' ? formatDateTime(mov.fecha).split(' ')[0] : formatDateTime(mov.fecha)}
                            </td>
                            <td className="px-4 py-3">
                              {mov.tipo === 'Saldo Inicial' ? (
                                <span className="inline-flex px-2 py-1 text-xs font-bold rounded bg-blue-600 text-white">
                                  📊 SALDO INICIAL
                                </span>
                              ) : (
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                                  mov.tipo === 'Compra' ? 'bg-blue-100 text-blue-700' :
                                  mov.tipo === 'Venta' ? 'bg-emerald-100 text-emerald-700' :
                                  mov.tipo.includes('Traspaso') ? 'bg-amber-100 text-amber-700' :
                                  mov.tipo === 'Ajuste Inv.' ? 'bg-purple-100 text-purple-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {mov.tipo}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{mov.documento}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-emerald-600">
                              {mov.entrada > 0 ? `+${mov.entrada}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-red-600">
                              {mov.salida > 0 ? `-${mov.salida}` : '-'}
                            </td>
                            <td className={`px-4 py-3 text-sm text-right font-bold ${
                              mov.tipo === 'Saldo Inicial' ? 'text-blue-600 text-base' : 'text-gray-900'
                            }`}>
                              {mov.saldo}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">{mov.detalles}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Vista móvil */}
                  <div className="md:hidden divide-y divide-gray-100">
                    {movimientos.map((mov, idx) => (
                      <div key={idx} className={`p-4 ${mov.tipo === 'Saldo Inicial' ? 'bg-blue-50' : ''}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            {mov.tipo === 'Saldo Inicial' ? (
                              <span className="inline-flex px-2 py-1 text-xs font-bold rounded bg-blue-600 text-white">
                                📊 SALDO INICIAL
                              </span>
                            ) : (
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                                mov.tipo === 'Compra' ? 'bg-blue-100 text-blue-700' :
                                mov.tipo === 'Venta' ? 'bg-emerald-100 text-emerald-700' :
                                mov.tipo.includes('Traspaso') ? 'bg-amber-100 text-amber-700' :
                                mov.tipo === 'Ajuste Inv.' ? 'bg-purple-100 text-purple-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {mov.tipo}
                              </span>
                            )}
                            <p className="text-sm font-medium text-gray-900 mt-1">{mov.documento}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {mov.tipo === 'Saldo Inicial' ? formatDateTime(mov.fecha).split(' ')[0] : formatDateTime(mov.fecha)}
                            </p>
                          </div>
                          <div className="text-right">
                            {mov.entrada > 0 && (
                              <p className="text-sm font-medium text-emerald-600">+{mov.entrada}</p>
                            )}
                            {mov.salida > 0 && (
                              <p className="text-sm font-medium text-red-600">-{mov.salida}</p>
                            )}
                            <p className={`text-xs mt-1 ${
                              mov.tipo === 'Saldo Inicial' ? 'text-blue-600 font-bold text-sm' : 'text-gray-500'
                            }`}>
                              Saldo: {mov.saldo}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500">{mov.detalles}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}