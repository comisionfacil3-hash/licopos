'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { formatCurrency } from '@/lib/utils/format'
import { formatDateTime } from '@/lib/utils/timezone'
import * as XLSX from 'xlsx'

interface Sucursal {
  id: string
  nombre: string
  empresa_id: string
}

interface Producto {
  id: string
  nombre: string
  codigo: string | null
  stock_actual: number
  precio_compra: number
}

interface ItemTraspaso {
  producto_id: string
  nombre: string
  codigo: string | null
  cantidad: number
  costo_unitario: number
  stock_disponible: number
}

interface Traspaso {
  id: string
  numero_traspaso: number
  sucursal_origen_id: string
  sucursal_destino_id: string
  sucursal_origen?: { nombre: string }
  sucursal_destino?: { nombre: string }
  estado: 'pendiente' | 'completado' | 'cancelado'
  total_items: number
  costo_total: number
  notas: string | null
  created_at: string
  usuario?: { nombre: string }
  detalles: any[]
}

export default function TraspasosPage() {
  const [traspasos, setTraspasos] = useState<Traspaso[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [showNuevoTraspaso, setShowNuevoTraspaso] = useState(false)
  const [showExito, setShowExito] = useState(false)
  const [mensajeExito, setMensajeExito] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // Formulario
  const [sucursalDestino, setSucursalDestino] = useState('')
  const [items, setItems] = useState<ItemTraspaso[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [notas, setNotas] = useState('')

  const { usuario } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (usuario?.empresa_id) {
      loadData()
    }
  }, [usuario?.empresa_id])

  const loadData = async () => {
    if (!usuario?.empresa_id || !usuario?.sucursal_id) return

    setLoading(true)
    try {
      // Sucursales de la empresa (excepto la actual)
      const { data: sucs } = await supabase
        .from('sucursales')
        .select('id, nombre, empresa_id')
        .eq('empresa_id', usuario.empresa_id)
        .eq('activa', true)
        .neq('id', usuario.sucursal_id)
        .order('nombre')

      setSucursales(sucs || [])

      // Productos de la sucursal actual
      const { data: prods } = await supabase
        .from('productos')
        .select('id, nombre, codigo, stock_actual, precio_compra')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('activo', true)
        .gt('stock_actual', 0)
        .order('nombre')

      setProductos(prods || [])

      // Traspasos
      const { data: trasps } = await supabase
        .from('traspasos')
        .select(`
          *,
          sucursal_origen:sucursales!traspasos_sucursal_origen_id_fkey(nombre),
          sucursal_destino:sucursales!traspasos_sucursal_destino_id_fkey(nombre),
          usuario:usuarios(nombre),
          detalles:traspaso_detalles(*)
        `)
        .eq('empresa_id', usuario.empresa_id)
        .or(`sucursal_origen_id.eq.${usuario.sucursal_id},sucursal_destino_id.eq.${usuario.sucursal_id}`)
        .order('created_at', { ascending: false })
        .limit(50)

      setTraspasos(trasps || [])

    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const mostrarExito = (mensaje: string) => {
    setMensajeExito(mensaje)
    setShowExito(true)
    setTimeout(() => setShowExito(false), 2500)
  }

  const agregarProducto = (producto: Producto) => {
    if (items.find(i => i.producto_id === producto.id)) return

    setItems(prev => [...prev, {
      producto_id: producto.id,
      nombre: producto.nombre,
      codigo: producto.codigo,
      cantidad: 1,
      costo_unitario: producto.precio_compra,
      stock_disponible: producto.stock_actual
    }])
    setBusqueda('')
  }

  const actualizarCantidad = (productoId: string, cantidad: number) => {
    setItems(prev => prev.map(i =>
      i.producto_id === productoId
        ? { ...i, cantidad: Math.min(Math.max(1, cantidad), i.stock_disponible) }
        : i
    ))
  }

  const eliminarItem = (productoId: string) => {
    setItems(prev => prev.filter(i => i.producto_id !== productoId))
  }

  const totalItems = items.reduce((sum, i) => sum + i.cantidad, 0)
  const costoTotal = items.reduce((sum, i) => sum + (i.cantidad * i.costo_unitario), 0)

  const guardarTraspaso = async () => {
    if (!sucursalDestino) {
      setError('Selecciona una sucursal destino')
      return
    }
    if (items.length === 0) {
      setError('Agrega al menos un producto')
      return
    }

    setGuardando(true)
    setError('')

    try {
      // Obtener número de traspaso
      const { data: numData } = await supabase.rpc('get_next_traspaso_number', {
        p_empresa_id: usuario?.empresa_id
      })
      const numeroTraspaso = numData || 1

      // Crear traspaso
      const { data: traspaso, error: traspError } = await supabase
        .from('traspasos')
        .insert({
          empresa_id: usuario?.empresa_id,
          sucursal_origen_id: usuario?.sucursal_id,
          sucursal_destino_id: sucursalDestino,
          usuario_id: usuario?.id,
          numero_traspaso: numeroTraspaso,
          total_items: totalItems,
          costo_total: costoTotal,
          estado: 'pendiente',
          notas: notas || null
        })
        .select()
        .single()

      if (traspError) throw traspError

      // Crear detalles y actualizar stock
      for (const item of items) {
        await supabase.rpc('actualizar_stock_producto', {
          p_producto_id: item.producto_id,
          p_cantidad: -item.cantidad
        })

        await supabase.from('traspaso_detalles').insert({
          traspaso_id: traspaso.id,
          producto_origen_id: item.producto_id,
          nombre_producto: item.nombre,
          cantidad: item.cantidad,
          costo_unitario: item.costo_unitario
        })
      }

      setShowNuevoTraspaso(false)
      setSucursalDestino('')
      setItems([])
      setNotas('')
      mostrarExito(`¡Traspaso #${numeroTraspaso} enviado!`)
      loadData()

    } catch (err) {
      console.error('Error:', err)
      setError('Error al procesar el traspaso')
    } finally {
      setGuardando(false)
    }
  }

  const exportarExcel = () => {
    if (traspasos.length === 0) return

    const data = traspasos.map(t => ({
      'N° Traspaso': t.numero_traspaso,
      'Fecha': formatDateTime(t.created_at),
      'Origen': t.sucursal_origen?.nombre || '',
      'Destino': t.sucursal_destino?.nombre || '',
      'Items': t.total_items,
      'Costo Total': t.costo_total,
      'Estado': t.estado === 'pendiente' ? 'Pendiente' : t.estado === 'completado' ? 'Completado' : 'Cancelado',
      'Usuario': t.usuario?.nombre || '',
      'Notas': t.notas || ''
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Traspasos')

    // Ajustar ancho de columnas
    ws['!cols'] = [
      { wch: 12 }, { wch: 18 }, { wch: 20 }, { wch: 20 },
      { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 30 }
    ]

    XLSX.writeFile(wb, `traspasos_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const productosFiltrados = busqueda
    ? productos.filter(p =>
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.codigo?.toLowerCase().includes(busqueda.toLowerCase())
      )
    : []

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando traspasos...</p>
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Traspasos</h1>
          <p className="text-gray-500 text-sm">Entre sucursales de tu empresa</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportarExcel}
            disabled={traspasos.length === 0}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="hidden sm:inline">Exportar</span>
          </button>
          <button
            onClick={() => { setError(''); setShowNuevoTraspaso(true) }}
            className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo
          </button>
        </div>
      </div>

      {/* Lista de traspasos */}
      <div className="space-y-3">
        {traspasos.map((traspaso) => (
          <div key={traspaso.id} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">Traspaso #{traspaso.numero_traspaso}</span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  traspaso.estado === 'completado' ? 'bg-green-100 text-green-700' :
                  traspaso.estado === 'pendiente' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {traspaso.estado === 'completado' ? 'Completado' : traspaso.estado === 'pendiente' ? 'Pendiente' : 'Cancelado'}
                </span>
              </div>
              <span className="text-sm text-gray-500">{formatDateTime(traspaso.created_at)}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">De:</span>
                <span className="font-medium text-gray-900">{traspaso.sucursal_origen?.nombre}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">A:</span>
                <span className="font-medium text-gray-900">{traspaso.sucursal_destino?.nombre}</span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <span className="text-sm text-gray-500">{traspaso.total_items} productos</span>
              <span className="font-medium text-emerald-600">{formatCurrency(traspaso.costo_total)}</span>
            </div>
          </div>
        ))}
      </div>

      {traspasos.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900">No hay traspasos</h3>
          <p className="text-gray-500">Crea tu primer traspaso entre sucursales</p>
        </div>
      )}

      {/* Modal Nuevo Traspaso */}
      {showNuevoTraspaso && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Nuevo Traspaso</h2>
              <p className="text-sm text-gray-500">Envía productos a otra sucursal</p>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Sucursal destino */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal destino</label>
                <select
                  value={sucursalDestino}
                  onChange={(e) => setSucursalDestino(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">Seleccionar sucursal</option>
                  {sucursales.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Buscar productos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agregar productos</label>
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Buscar por nombre o código..."
                />
                {productosFiltrados.length > 0 && (
                  <div className="mt-2 bg-gray-50 rounded-xl p-2 max-h-40 overflow-y-auto">
                    {productosFiltrados.slice(0, 5).map(p => (
                      <button
                        key={p.id}
                        onClick={() => agregarProducto(p)}
                        className="w-full text-left px-3 py-2 hover:bg-white rounded-lg flex justify-between items-center"
                      >
                        <span className="text-sm font-medium text-gray-900">{p.nombre}</span>
                        <span className="text-xs text-gray-500">Stock: {p.stock_actual}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Items seleccionados */}
              {items.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Productos a traspasar</label>
                  <div className="space-y-2">
                    {items.map(item => (
                      <div key={item.producto_id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{item.nombre}</p>
                          <p className="text-xs text-gray-500">Stock: {item.stock_disponible}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => actualizarCantidad(item.producto_id, item.cantidad - 1)}
                            className="w-8 h-8 bg-white border rounded-lg flex items-center justify-center"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={item.cantidad}
                            onChange={(e) => actualizarCantidad(item.producto_id, parseInt(e.target.value) || 1)}
                            className="w-14 text-center border rounded-lg py-1"
                            min="1"
                            max={item.stock_disponible}
                          />
                          <button
                            onClick={() => actualizarCantidad(item.producto_id, item.cantidad + 1)}
                            className="w-8 h-8 bg-white border rounded-lg flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => eliminarItem(item.producto_id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                  rows={2}
                  placeholder="Observaciones..."
                />
              </div>

              {/* Resumen */}
              {items.length > 0 && (
                <div className="bg-emerald-50 rounded-xl p-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Total productos:</span>
                    <span className="font-medium">{totalItems} unidades</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Costo total:</span>
                    <span className="font-bold text-emerald-600">{formatCurrency(costoTotal)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setShowNuevoTraspaso(false)
                  setItems([])
                  setSucursalDestino('')
                  setNotas('')
                }}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={guardarTraspaso}
                disabled={guardando}
                className="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50"
              >
                {guardando ? 'Enviando...' : 'Enviar Traspaso'}
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
