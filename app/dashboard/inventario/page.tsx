// Path: app\dashboard\inventario\page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { formatCurrency } from '@/lib/utils/format'
import { formatDateTime } from '@/lib/utils/timezone'
import * as XLSX from 'xlsx'

interface Inventario {
  id: string
  sucursal_id: string
  usuario_id: string
  estado: string
  fecha_inicio: string
  fecha_cierre: string | null
  total_productos: number
  productos_contados: number
  productos_con_diferencia: number
  notas: string | null
}

interface DetalleInventario {
  id: string
  inventario_id: string
  producto_id: string
  stock_sistema: number
  stock_contado: number | null
  diferencia: number
  costo_diferencia: number
  costo_unitario: number
  contado: boolean
  notas: string | null
  producto: {
    id: string
    nombre: string
    codigo: string | null
    categoria_nombre: string
  }
}

export default function InventarioPage() {
  const [inventarioActivo, setInventarioActivo] = useState<Inventario | null>(null)
  const [detalles, setDetalles] = useState<DetalleInventario[]>([])
  const [historial, setHistorial] = useState<Inventario[]>([])
  const [loading, setLoading] = useState(true)
  const [iniciando, setIniciando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'pendientes' | 'contados' | 'diferencias'>('todos')
  
  // Modales
  const [showIniciarModal, setShowIniciarModal] = useState(false)
  const [showAplicarModal, setShowAplicarModal] = useState(false)
  const [showCancelarModal, setShowCancelarModal] = useState(false)
  const [showExito, setShowExito] = useState(false)
  const [mensajeExito, setMensajeExito] = useState('')
  const [showHistorialModal, setShowHistorialModal] = useState(false)
  const [inventarioSeleccionado, setInventarioSeleccionado] = useState<Inventario | null>(null)
  const [detallesHistorial, setDetallesHistorial] = useState<DetalleInventario[]>([])

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
      // 1. Buscar inventario en proceso
      const { data: invActivo } = await supabase
        .from('inventarios')
        .select('*')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('estado', 'en_proceso')
        .maybeSingle()

      if (invActivo) {
        setInventarioActivo(invActivo)

        // 2. Cargar detalles del inventario
        const { data: dets } = await supabase
          .from('inventario_detalles')
          .select('*')
          .eq('inventario_id', invActivo.id)
          .order('contado', { ascending: true })

        if (dets && dets.length > 0) {
          // 3. Obtener productos
          const productoIds = dets.map(d => d.producto_id)
          const { data: productosData } = await supabase
            .from('productos')
            .select('id, nombre, codigo, categoria_id')
            .in('id', productoIds)

          // 4. Obtener categorías
          const categoriaIds = [...new Set(productosData?.map(p => p.categoria_id).filter(Boolean))]
          let categoriasMap = new Map<string, string>()
          
          if (categoriaIds.length > 0) {
            const { data: categoriasData } = await supabase
              .from('categorias')
              .select('id, nombre')
              .in('id', categoriaIds as string[])
            
            categoriasMap = new Map(categoriasData?.map(c => [c.id, c.nombre]) || [])
          }

          const productosMap = new Map(productosData?.map(p => [p.id, {
            ...p,
            categoria_nombre: p.categoria_id ? (categoriasMap.get(p.categoria_id) || 'Sin categoría') : 'Sin categoría'
          }]) || [])

          const detallesCompletos: DetalleInventario[] = dets.map(d => {
            const prod = productosMap.get(d.producto_id)
            return {
              id: d.id,
              inventario_id: d.inventario_id,
              producto_id: d.producto_id,
              stock_sistema: d.stock_sistema || 0,
              stock_contado: d.stock_contado,
              diferencia: d.diferencia || 0,
              costo_diferencia: d.costo_diferencia || 0,
              costo_unitario: d.costo_unitario || 0,
              contado: d.contado || false,
              notas: d.notas,
              producto: {
                id: prod?.id || d.producto_id,
                nombre: prod?.nombre || 'Producto eliminado',
                codigo: prod?.codigo || null,
                categoria_nombre: prod?.categoria_nombre || 'Sin categoría'
              }
            }
          })
          setDetalles(detallesCompletos)
        } else {
          setDetalles([])
        }
      } else {
        setInventarioActivo(null)
        setDetalles([])
      }

      // 5. Historial
      const { data: hist } = await supabase
        .from('inventarios')
        .select('*')
        .eq('sucursal_id', usuario.sucursal_id)
        .neq('estado', 'en_proceso')
        .order('fecha_inicio', { ascending: false })
        .limit(10)

      setHistorial(hist || [])

    } catch (err) {
      console.error('Error general:', err)
    } finally {
      setLoading(false)
    }
  }

  const detallesFiltrados = useMemo(() => {
    let resultado = detalles

    if (busqueda) {
      const termino = busqueda.toLowerCase()
      resultado = resultado.filter(d =>
        d.producto.nombre.toLowerCase().includes(termino) ||
        d.producto.codigo?.toLowerCase().includes(termino)
      )
    }

    switch (filtro) {
      case 'pendientes':
        resultado = resultado.filter(d => !d.contado)
        break
      case 'contados':
        resultado = resultado.filter(d => d.contado)
        break
      case 'diferencias':
        resultado = resultado.filter(d => d.contado && d.diferencia !== 0)
        break
    }

    return resultado
  }, [detalles, busqueda, filtro])

  const estadisticas = useMemo(() => {
    const contados = detalles.filter(d => d.contado).length
    const conDiferencia = detalles.filter(d => d.contado && d.diferencia !== 0).length
    const diferenciaSobrante = detalles
      .filter(d => d.contado && d.diferencia > 0)
      .reduce((sum, d) => sum + (d.costo_diferencia || 0), 0)
    const diferenciaFaltante = detalles
      .filter(d => d.contado && d.diferencia < 0)
      .reduce((sum, d) => sum + Math.abs(d.costo_diferencia || 0), 0)

    return {
      total: detalles.length,
      contados,
      pendientes: detalles.length - contados,
      conDiferencia,
      diferenciaSobrante,
      diferenciaFaltante
    }
  }, [detalles])

  const mostrarExito = (mensaje: string) => {
    setMensajeExito(mensaje)
    setShowExito(true)
    setTimeout(() => setShowExito(false), 2500)
  }

  // ============================================
  // INICIAR INVENTARIO - SIN COLUMNAS GENERADAS
  // ============================================
  const iniciarInventario = async () => {
    if (!usuario?.sucursal_id || !usuario?.id) return

    setIniciando(true)
    try {
      // 1. Verificar que no exista uno en proceso
      const { data: existente } = await supabase
        .from('inventarios')
        .select('id')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('estado', 'en_proceso')
        .maybeSingle()

      if (existente) {
        setShowIniciarModal(false)
        await loadData()
        return
      }

      // 2. Obtener todos los productos de la sucursal
      const { data: productos, error: prodError } = await supabase
        .from('productos')
        .select('id, stock_actual, precio_compra')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('activo', true)

      if (prodError) throw new Error('Error al obtener productos')
      if (!productos || productos.length === 0) {
        throw new Error('No hay productos activos en esta sucursal')
      }

      // 3. Crear el inventario
      const { data: nuevoInventario, error: invError } = await supabase
        .from('inventarios')
        .insert({
          sucursal_id: usuario.sucursal_id,
          usuario_id: usuario.id,
          estado: 'en_proceso',
          fecha_inicio: new Date().toISOString(),
          total_productos: productos.length,
          productos_contados: 0,
          productos_con_diferencia: 0
        })
        .select()
        .single()

      if (invError) throw new Error('Error al crear el inventario')

      // 4. Crear detalles SIN diferencia ni costo_diferencia (son columnas generadas)
      const detallesAInsertar = productos.map(p => ({
        inventario_id: nuevoInventario.id,
        producto_id: p.id,
        stock_sistema: p.stock_actual || 0,
        stock_contado: null,
        costo_unitario: p.precio_compra || 0,
        contado: false
      }))

      const { error: detError } = await supabase
        .from('inventario_detalles')
        .insert(detallesAInsertar)

      if (detError) {
        await supabase.from('inventarios').delete().eq('id', nuevoInventario.id)
        throw new Error('Error al crear detalles del inventario')
      }

      setShowIniciarModal(false)
      mostrarExito(`¡Inventario iniciado con ${productos.length} productos!`)
      await loadData()

    } catch (err: any) {
      console.error('Error:', err)
      alert(err.message || 'Error al iniciar el inventario')
    } finally {
      setIniciando(false)
    }
  }

  const actualizarConteo = async (detalleId: string, stockContado: number | null) => {
    // 1. Actualizar estado local INMEDIATAMENTE (optimistic update)
    setDetalles(prev => prev.map(d => {
      if (d.id !== detalleId) return d
      
      const nuevoStockContado = stockContado
      const diferencia = nuevoStockContado !== null 
        ? nuevoStockContado - d.stock_sistema 
        : 0
      const costoDiferencia = diferencia * d.costo_unitario
      
      return {
        ...d,
        stock_contado: nuevoStockContado,
        contado: nuevoStockContado !== null,
        diferencia,
        costo_diferencia: costoDiferencia
      }
    }))

    // 2. Actualizar en base de datos en segundo plano
    if (stockContado === null) {
      supabase
        .from('inventario_detalles')
        .update({ stock_contado: null, contado: false })
        .eq('id', detalleId)
        .then()
    } else {
      supabase
        .from('inventario_detalles')
        .update({ stock_contado: stockContado, contado: true })
        .eq('id', detalleId)
        .then()
    }
  }

  const aplicarAjustes = async () => {
    if (!inventarioActivo) return

    setAplicando(true)
    try {
      // Actualizar stock de productos con diferencia
      for (const detalle of detalles.filter(d => d.contado && d.diferencia !== 0)) {
        await supabase
          .from('productos')
          .update({ stock_actual: detalle.stock_contado })
          .eq('id', detalle.producto_id)
      }

      // Marcar inventario como completado
      await supabase
        .from('inventarios')
        .update({
          estado: 'completado',
          fecha_cierre: new Date().toISOString(),
          productos_contados: estadisticas.contados,
          productos_con_diferencia: estadisticas.conDiferencia
        })
        .eq('id', inventarioActivo.id)

      setShowAplicarModal(false)
      mostrarExito('¡Inventario aplicado exitosamente!')
      await loadData()

    } catch (err) {
      console.error('Error:', err)
      alert('Error al aplicar los ajustes')
    } finally {
      setAplicando(false)
    }
  }

  const cancelarInventario = async () => {
    if (!inventarioActivo) return

    try {
      await supabase
        .from('inventarios')
        .update({ estado: 'cancelado', fecha_cierre: new Date().toISOString() })
        .eq('id', inventarioActivo.id)

      setShowCancelarModal(false)
      mostrarExito('Inventario cancelado')
      await loadData()
    } catch (err) {
      console.error('Error:', err)
      alert('Error al cancelar')
    }
  }

  const verHistorial = async (inventario: Inventario) => {
    setInventarioSeleccionado(inventario)
    
    // Cargar detalles del inventario histórico
    const { data: dets } = await supabase
      .from('inventario_detalles')
      .select('*')
      .eq('inventario_id', inventario.id)

    if (dets) {
      const productoIds = dets.map(d => d.producto_id)
      const { data: productosData } = await supabase
        .from('productos')
        .select('id, nombre, codigo, categoria_id')
        .in('id', productoIds)

      const categoriaIds = [...new Set(productosData?.map(p => p.categoria_id).filter(Boolean))]
      let categoriasMap = new Map<string, string>()
      
      if (categoriaIds.length > 0) {
        const { data: categoriasData } = await supabase
          .from('categorias')
          .select('id, nombre')
          .in('id', categoriaIds as string[])
        
        categoriasMap = new Map(categoriasData?.map(c => [c.id, c.nombre]) || [])
      }

      const productosMap = new Map(productosData?.map(p => [p.id, {
        ...p,
        categoria_nombre: p.categoria_id ? (categoriasMap.get(p.categoria_id) || 'Sin categoría') : 'Sin categoría'
      }]) || [])

      const detallesCompletos = dets.map(d => {
        const prod = productosMap.get(d.producto_id)
        return {
          id: d.id,
          inventario_id: d.inventario_id,
          producto_id: d.producto_id,
          stock_sistema: d.stock_sistema || 0,
          stock_contado: d.stock_contado,
          diferencia: d.diferencia || 0,
          costo_diferencia: d.costo_diferencia || 0,
          costo_unitario: d.costo_unitario || 0,
          contado: d.contado || false,
          notas: d.notas,
          producto: {
            id: prod?.id || d.producto_id,
            nombre: prod?.nombre || 'Producto eliminado',
            codigo: prod?.codigo || null,
            categoria_nombre: prod?.categoria_nombre || 'Sin categoría'
          }
        }
      })

      setDetallesHistorial(detallesCompletos)
    }

    setShowHistorialModal(true)
  }

  const exportarInventarioExcel = (inventario: Inventario, detalles: DetalleInventario[]) => {
    const data = detalles.map(d => ({
      'Producto': d.producto.nombre,
      'Código': d.producto.codigo || '',
      'Categoría': d.producto.categoria_nombre,
      'Stock Sistema': d.stock_sistema,
      'Stock Contado': d.stock_contado ?? '',
      'Diferencia': d.diferencia,
      'Costo Unit.': d.costo_unitario,
      'Costo Diferencia': d.costo_diferencia
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario')

    // Ajustar ancho de columnas
    ws['!cols'] = [
      { wch: 30 }, // Producto
      { wch: 12 }, // Código
      { wch: 15 }, // Categoría
      { wch: 12 }, // Stock Sistema
      { wch: 12 }, // Stock Contado
      { wch: 12 }, // Diferencia
      { wch: 10 }, // Costo Unit
      { wch: 15 }  // Costo Diferencia
    ]

    const fecha = formatDateTime(inventario.fecha_inicio).replace(/[/:]/g, '-')
    XLSX.writeFile(wb, `inventario_${fecha}.xlsx`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando inventario...</p>
        </div>
      </div>
    )
  }

  // Sin inventario activo - mostrar historial
  if (!inventarioActivo) {
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

        {/* Modal Iniciar */}
        {showIniciarModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm animate-bounce-in">
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Iniciar Inventario</h2>
                <p className="text-gray-500 mb-4">
                  Se iniciará el conteo de todos los productos activos de tu sucursal.
                </p>
              </div>
              <div className="p-6 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => setShowIniciarModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={iniciarInventario}
                  disabled={iniciando}
                  className="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {iniciando ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Iniciando...
                    </>
                  ) : 'Iniciar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Historial Detalle */}
        {showHistorialModal && inventarioSeleccionado && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-bold text-gray-900">Detalle de Inventario</h2>
                  <button
                    onClick={() => setShowHistorialModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-sm text-gray-500">
                  {formatDateTime(inventarioSeleccionado.fecha_inicio)}
                  {inventarioSeleccionado.fecha_cierre && ` - ${formatDateTime(inventarioSeleccionado.fecha_cierre)}`}
                </p>
                <div className="flex gap-3 mt-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    inventarioSeleccionado.estado === 'completado' ? 'bg-green-100 text-green-700' :
                    inventarioSeleccionado.estado === 'cancelado' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {inventarioSeleccionado.estado === 'completado' ? '✓ Completado' : '✗ Cancelado'}
                  </span>
                  <button
                    onClick={() => exportarInventarioExcel(inventarioSeleccionado, detallesHistorial)}
                    className="px-3 py-1 bg-emerald-500 text-white rounded-full text-xs font-medium hover:bg-emerald-600 flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Excel
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-2">
                  {detallesHistorial.map(detalle => (
                    <div key={detalle.id} className={`p-3 rounded-lg border ${
                      detalle.diferencia > 0 ? 'bg-blue-50 border-blue-200' :
                      detalle.diferencia < 0 ? 'bg-red-50 border-red-200' :
                      'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{detalle.producto.nombre}</p>
                          <p className="text-xs text-gray-500">{detalle.producto.codigo || 'Sin código'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">
                            Sistema: <span className="font-medium">{detalle.stock_sistema}</span>
                          </p>
                          <p className="text-sm">
                            Físico: <span className="font-medium">{detalle.stock_contado ?? '-'}</span>
                          </p>
                          {detalle.diferencia !== 0 && (
                            <p className={`text-sm font-bold ${
                              detalle.diferencia > 0 ? 'text-blue-600' : 'text-red-600'
                            }`}>
                              Dif: {detalle.diferencia > 0 ? '+' : ''}{detalle.diferencia}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
            <p className="text-gray-500 text-sm">No hay inventario activo</p>
          </div>
          <button
            onClick={() => setShowIniciarModal(true)}
            className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Iniciar Inventario
          </button>
        </div>

        {/* Historial */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Historial</h2>
          {historial.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <p className="text-gray-500">No hay inventarios realizados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historial.map(inv => (
                <div key={inv.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">Inventario</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        inv.estado === 'completado' ? 'bg-green-100 text-green-700' :
                        inv.estado === 'cancelado' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {inv.estado === 'completado' ? 'Completado' : 'Cancelado'}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">{formatDateTime(inv.fecha_inicio)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm mt-3">
                    <div>
                      <p className="text-gray-500">Total</p>
                      <p className="font-medium">{inv.total_productos}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Contados</p>
                      <p className="font-medium">{inv.productos_contados}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Diferencias</p>
                      <p className="font-medium">{inv.productos_con_diferencia}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => verHistorial(inv)}
                    className="w-full mt-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                  >
                    Ver Detalle
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

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

  // Con inventario activo - modo conteo
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

      {/* Modal Aplicar */}
      {showAplicarModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm animate-bounce-in">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">¿Aplicar Ajustes?</h2>
              <p className="text-gray-500 mb-4">
                Se actualizará el stock de {estadisticas.conDiferencia} producto(s) con diferencia.
              </p>
              {estadisticas.diferenciaFaltante > 0 && (
                <div className="bg-red-50 rounded-lg p-3 mb-3">
                  <p className="text-sm text-red-700">
                    Faltante: {formatCurrency(estadisticas.diferenciaFaltante)}
                  </p>
                </div>
              )}
              {estadisticas.diferenciaSobrante > 0 && (
                <div className="bg-blue-50 rounded-lg p-3 mb-3">
                  <p className="text-sm text-blue-700">
                    Sobrante: {formatCurrency(estadisticas.diferenciaSobrante)}
                  </p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowAplicarModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={aplicarAjustes}
                disabled={aplicando}
                className="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {aplicando ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Aplicando...
                  </>
                ) : 'Aplicar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cancelar */}
      {showCancelarModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm animate-bounce-in">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">¿Cancelar Inventario?</h2>
              <p className="text-gray-500">
                Se cancelará el inventario actual y no se aplicarán cambios al stock.
              </p>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowCancelarModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50"
              >
                No, continuar
              </button>
              <button
                onClick={cancelarInventario}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600"
              >
                Sí, cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario en Proceso</h1>
          <p className="text-gray-500 text-sm">
            Iniciado: {formatDateTime(inventarioActivo.fecha_inicio)}
          </p>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">Progreso del conteo</span>
          <span className="text-sm font-medium">{estadisticas.contados} de {estadisticas.total}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${estadisticas.total > 0 ? (estadisticas.contados / estadisticas.total) * 100 : 0}%` }}
          ></div>
        </div>
      </div>

      {/* Estadísticas / Filtros */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <button 
          onClick={() => setFiltro('todos')} 
          className={`p-3 rounded-xl text-center transition-all ${filtro === 'todos' ? 'bg-emerald-100 border-2 border-emerald-500' : 'bg-white border border-gray-200'}`}
        >
          <p className="text-lg font-bold text-gray-900">{estadisticas.total}</p>
          <p className="text-xs text-gray-500">Total</p>
        </button>
        <button 
          onClick={() => setFiltro('pendientes')} 
          className={`p-3 rounded-xl text-center transition-all ${filtro === 'pendientes' ? 'bg-amber-100 border-2 border-amber-500' : 'bg-white border border-gray-200'}`}
        >
          <p className="text-lg font-bold text-amber-600">{estadisticas.pendientes}</p>
          <p className="text-xs text-gray-500">Pendientes</p>
        </button>
        <button 
          onClick={() => setFiltro('contados')} 
          className={`p-3 rounded-xl text-center transition-all ${filtro === 'contados' ? 'bg-blue-100 border-2 border-blue-500' : 'bg-white border border-gray-200'}`}
        >
          <p className="text-lg font-bold text-blue-600">{estadisticas.contados}</p>
          <p className="text-xs text-gray-500">Contados</p>
        </button>
        <button 
          onClick={() => setFiltro('diferencias')} 
          className={`p-3 rounded-xl text-center transition-all ${filtro === 'diferencias' ? 'bg-red-100 border-2 border-red-500' : 'bg-white border border-gray-200'}`}
        >
          <p className="text-lg font-bold text-red-600">{estadisticas.conDiferencia}</p>
          <p className="text-xs text-gray-500">Diferencias</p>
        </button>
      </div>

      {/* Buscador */}
      <div className="mb-4">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
          placeholder="Buscar producto..."
        />
      </div>

      {/* Lista de productos para contar */}
      <div className="space-y-2 mb-32">
        {detallesFiltrados.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-xl border border-gray-100">
            <p className="text-gray-500">
              {busqueda ? 'No se encontraron productos' : `No hay productos ${filtro !== 'todos' ? 'en esta categoría' : ''}`}
            </p>
          </div>
        ) : (
          detallesFiltrados.map((detalle) => (
            <div 
              key={detalle.id} 
              className={`bg-white rounded-xl border p-4 transition-all ${
                detalle.contado 
                  ? detalle.diferencia !== 0 
                    ? 'border-red-200 bg-red-50/30' 
                    : 'border-emerald-200 bg-emerald-50/30'
                  : 'border-amber-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 truncate">{detalle.producto.nombre}</h4>
                  <p className="text-xs text-gray-500">
                    {detalle.producto.codigo || 'Sin código'} • {detalle.producto.categoria_nombre}
                  </p>
                </div>
                <div className="text-right ml-2">
                  <p className="text-sm text-gray-500">
                    Sistema: <span className="font-semibold text-gray-900">{detalle.stock_sistema}</span>
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <input
                    type="number"
                    value={detalle.stock_contado ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : parseInt(e.target.value)
                      actualizarConteo(detalle.id, val)
                    }}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-center text-lg font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Cantidad física"
                    min="0"
                  />
                </div>
                
                {detalle.contado && (
                  <div className={`px-3 py-2 rounded-xl text-sm font-medium min-w-[60px] text-center ${
                    detalle.diferencia > 0 
                      ? 'bg-blue-100 text-blue-700' 
                      : detalle.diferencia < 0 
                        ? 'bg-red-100 text-red-700'
                        : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {detalle.diferencia === 0 ? '✓ OK' : (detalle.diferencia > 0 ? '+' : '') + detalle.diferencia}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Botones fijos */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-4xl mx-auto flex gap-3">
          <button
            onClick={() => setShowCancelarModal(true)}
            className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => setShowAplicarModal(true)}
            disabled={estadisticas.contados === 0}
            className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 disabled:opacity-50"
          >
            Aplicar Ajustes ({estadisticas.contados})
          </button>
        </div>
      </div>

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