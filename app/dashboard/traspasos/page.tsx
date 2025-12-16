'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { formatCurrency } from '@/lib/utils/format'
import { formatDateTime } from '@/lib/utils/timezone'
import * as XLSX from 'xlsx'

interface Sucursal {
  id: string
  nombre: string
}

interface Producto {
  id: string
  nombre: string
  codigo: string
  precio_compra: number
  precio_venta: number
  stock_actual: number
}

interface ItemTraspaso {
  producto_id: string
  nombre: string
  codigo: string
  cantidad: number
  costo_unitario: number
  stock_disponible: number
}

interface TraspasoDetalle {
  id: string
  nombre_producto: string
  cantidad: number
  costo_unitario: number
}

interface Traspaso {
  id: string
  numero_traspaso: number
  sucursal_origen_nombre: string
  sucursal_destino_nombre: string
  usuario_nombre: string
  estado: string
  notas: string | null
  created_at: string
  detalles: TraspasoDetalle[]
  total_items: number
  total_costo: number
}

export default function TraspasosPage() {
  const [traspasos, setTraspasos] = useState<Traspaso[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [sucursalActual, setSucursalActual] = useState<Sucursal | null>(null)
  const [traspasoSeleccionado, setTraspasoSeleccionado] = useState<Traspaso | null>(null)
  
  // Estados para nuevo traspaso
  const [showNuevoTraspaso, setShowNuevoTraspaso] = useState(false)
  const [sucursalDestinoId, setSucursalDestinoId] = useState('')
  const [items, setItems] = useState<ItemTraspaso[]>([])
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  
  // Estados para agregar item
  const [productoSeleccionado, setProductoSeleccionado] = useState('')
  const [cantidadItem, setCantidadItem] = useState('')
  
  // Estado para éxito
  const [showExito, setShowExito] = useState(false)
  const [traspasoExitoso, setTraspasoExitoso] = useState<number | null>(null)
  
  // Permisos
  const [tienePermiso, setTienePermiso] = useState(false)

  const { usuario } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (usuario?.sucursal_id && usuario?.empresa_id) {
      // Verificar si es gerente o admin
      if (usuario.rol === 'gerente' || usuario.rol === 'admin') {
        setTienePermiso(true)
        loadData()
      } else {
        setTienePermiso(false)
        setLoading(false)
      }
    }
  }, [usuario?.sucursal_id, usuario?.empresa_id, usuario?.rol])

  const loadData = async () => {
    if (!usuario?.sucursal_id || !usuario?.empresa_id) return

    setLoading(true)
    try {
      // Cargar sucursal actual
      const { data: sucursalActualData } = await supabase
        .from('sucursales')
        .select('id, nombre')
        .eq('id', usuario.sucursal_id)
        .single()

      setSucursalActual(sucursalActualData)

      // Cargar todas las sucursales de la empresa (excepto la actual)
      const { data: sucursalesData } = await supabase
        .from('sucursales')
        .select('id, nombre')
        .eq('empresa_id', usuario.empresa_id)
        .eq('activa', true)
        .neq('id', usuario.sucursal_id)
        .order('nombre')

      setSucursales(sucursalesData || [])

      // Cargar productos de la sucursal actual
      const { data: productosData } = await supabase
        .from('productos')
        .select('id, nombre, codigo, precio_compra, precio_venta, stock_actual')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('activo', true)
        .gt('stock_actual', 0)
        .order('nombre')

      setProductos(productosData || [])

      // Cargar historial de traspasos de la empresa
      const { data: traspasosData } = await supabase
        .from('traspasos')
        .select('*')
        .eq('empresa_id', usuario.empresa_id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (traspasosData && traspasosData.length > 0) {
        // Obtener IDs únicos
        const sucursalIds = [
          ...new Set([
            ...traspasosData.map(t => t.sucursal_origen_id),
            ...traspasosData.map(t => t.sucursal_destino_id)
          ])
        ]
        const usuarioIds = [...new Set(traspasosData.map(t => t.usuario_id))]
        const traspasoIds = traspasosData.map(t => t.id)

        // Cargar sucursales
        let sucursalesMap: Record<string, string> = {}
        if (sucursalIds.length > 0) {
          const { data: sucData } = await supabase
            .from('sucursales')
            .select('id, nombre')
            .in('id', sucursalIds)
          if (sucData) {
            sucData.forEach(s => { sucursalesMap[s.id] = s.nombre })
          }
        }

        // Cargar usuarios
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

        // Cargar detalles
        const { data: detallesData } = await supabase
          .from('traspaso_detalles')
          .select('*')
          .in('traspaso_id', traspasoIds)

        const traspasosCompletos: Traspaso[] = traspasosData.map(traspaso => {
          const detalles = (detallesData || [])
            .filter(d => d.traspaso_id === traspaso.id)
            .map(d => ({
              id: d.id,
              nombre_producto: d.nombre_producto,
              cantidad: d.cantidad,
              costo_unitario: d.costo_unitario
            }))

          const totalItems = detalles.reduce((sum, d) => sum + d.cantidad, 0)
          const totalCosto = detalles.reduce((sum, d) => sum + (d.cantidad * d.costo_unitario), 0)

          return {
            id: traspaso.id,
            numero_traspaso: traspaso.numero_traspaso,
            sucursal_origen_nombre: sucursalesMap[traspaso.sucursal_origen_id] || 'Desconocida',
            sucursal_destino_nombre: sucursalesMap[traspaso.sucursal_destino_id] || 'Desconocida',
            usuario_nombre: usuariosMap[traspaso.usuario_id] || 'Desconocido',
            estado: traspaso.estado,
            notas: traspaso.notas,
            created_at: traspaso.created_at,
            detalles,
            total_items: totalItems,
            total_costo: totalCosto
          }
        })

        setTraspasos(traspasosCompletos)
      } else {
        setTraspasos([])
      }

    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }

  // Agregar item al traspaso
  const agregarItem = () => {
    if (!productoSeleccionado) {
      setError('Seleccione un producto')
      return
    }

    const cantidad = parseInt(cantidadItem) || 0
    if (cantidad <= 0) {
      setError('Ingrese una cantidad válida')
      return
    }

    const producto = productos.find(p => p.id === productoSeleccionado)
    if (!producto) return

    if (cantidad > producto.stock_actual) {
      setError(`Stock insuficiente. Disponible: ${producto.stock_actual}`)
      return
    }

    const existente = items.find(i => i.producto_id === productoSeleccionado)
    if (existente) {
      const nuevaCantidad = existente.cantidad + cantidad
      if (nuevaCantidad > producto.stock_actual) {
        setError(`Stock insuficiente. Disponible: ${producto.stock_actual}`)
        return
      }
      setItems(prev => prev.map(i =>
        i.producto_id === productoSeleccionado
          ? { ...i, cantidad: nuevaCantidad }
          : i
      ))
    } else {
      setItems(prev => [...prev, {
        producto_id: producto.id,
        nombre: producto.nombre,
        codigo: producto.codigo || '',
        cantidad,
        costo_unitario: producto.precio_compra,
        stock_disponible: producto.stock_actual
      }])
    }

    setProductoSeleccionado('')
    setCantidadItem('')
    setError('')
  }

  // Eliminar item
  const eliminarItem = (productoId: string) => {
    setItems(prev => prev.filter(i => i.producto_id !== productoId))
  }

  // Total del traspaso
  const totalTraspaso = items.reduce((sum, item) => sum + (item.cantidad * item.costo_unitario), 0)
  const totalUnidades = items.reduce((sum, item) => sum + item.cantidad, 0)

  // Abrir modal nuevo traspaso
  const abrirNuevoTraspaso = () => {
    if (sucursales.length === 0) {
      setError('No hay otras sucursales disponibles para traspasar')
      return
    }
    setItems([])
    setSucursalDestinoId('')
    setNotas('')
    setError('')
    setShowNuevoTraspaso(true)
  }

  // Guardar traspaso
  const guardarTraspaso = async () => {
    if (!usuario?.sucursal_id || !usuario?.empresa_id || !usuario?.id) return

    if (!sucursalDestinoId) {
      setError('Seleccione la sucursal destino')
      return
    }

    if (items.length === 0) {
      setError('Agregue al menos un producto')
      return
    }

    setGuardando(true)
    setError('')

    try {
      // Obtener número de traspaso
      const { data: maxTraspaso } = await supabase
        .from('traspasos')
        .select('numero_traspaso')
        .eq('empresa_id', usuario.empresa_id)
        .order('numero_traspaso', { ascending: false })
        .limit(1)
        .maybeSingle()

      const numeroTraspaso = (maxTraspaso?.numero_traspaso || 0) + 1

      // Crear traspaso
      const { data: traspaso, error: traspasoError } = await supabase
        .from('traspasos')
        .insert({
          empresa_id: usuario.empresa_id,
          sucursal_origen_id: usuario.sucursal_id,
          sucursal_destino_id: sucursalDestinoId,
          usuario_id: usuario.id,
          numero_traspaso: numeroTraspaso,
          estado: 'completado',
          notas: notas.trim() || null
        })
        .select()
        .single()

      if (traspasoError) throw traspasoError

      // Procesar cada item
      for (const item of items) {
        // 1. Descontar stock de origen
        await supabase
          .from('productos')
          .update({ 
            stock_actual: supabase.rpc('decrement_stock', { 
              row_id: item.producto_id, 
              amount: item.cantidad 
            })
          })
          .eq('id', item.producto_id)

        // Alternativa: usar SQL directo
        await supabase.rpc('actualizar_stock_producto', {
          p_producto_id: item.producto_id,
          p_cantidad: -item.cantidad
        })

        // 2. Buscar producto equivalente en destino (por código o nombre)
        let productoDestinoId: string | null = null

        // Buscar por código primero
        if (item.codigo) {
          const { data: prodDestino } = await supabase
            .from('productos')
            .select('id')
            .eq('sucursal_id', sucursalDestinoId)
            .eq('codigo', item.codigo)
            .maybeSingle()
          
          if (prodDestino) {
            productoDestinoId = prodDestino.id
          }
        }

        // Si no se encontró por código, buscar por nombre exacto
        if (!productoDestinoId) {
          const { data: prodDestino } = await supabase
            .from('productos')
            .select('id')
            .eq('sucursal_id', sucursalDestinoId)
            .ilike('nombre', item.nombre)
            .maybeSingle()
          
          if (prodDestino) {
            productoDestinoId = prodDestino.id
          }
        }

        // 3. Si existe en destino, sumar stock; si no, crear producto
        if (productoDestinoId) {
          await supabase.rpc('actualizar_stock_producto', {
            p_producto_id: productoDestinoId,
            p_cantidad: item.cantidad
          })
        } else {
          // Obtener datos completos del producto origen
          const { data: productoOrigen } = await supabase
            .from('productos')
            .select('*')
            .eq('id', item.producto_id)
            .single()

          if (productoOrigen) {
            const { data: nuevoProducto } = await supabase
              .from('productos')
              .insert({
                sucursal_id: sucursalDestinoId,
                categoria_id: productoOrigen.categoria_id,
                codigo: productoOrigen.codigo,
                codigo_barras: productoOrigen.codigo_barras,
                nombre: productoOrigen.nombre,
                descripcion: productoOrigen.descripcion,
                marca: productoOrigen.marca,
                unidad: productoOrigen.unidad,
                precio_compra: productoOrigen.precio_compra,
                precio_venta: productoOrigen.precio_venta,
                stock_actual: item.cantidad,
                stock_minimo: productoOrigen.stock_minimo,
                stock_maximo: productoOrigen.stock_maximo,
                imagen_url: productoOrigen.imagen_url,
                activo: true
              })
              .select()
              .single()

            productoDestinoId = nuevoProducto?.id || null
          }
        }

        // 4. Registrar detalle del traspaso
        await supabase.from('traspaso_detalles').insert({
          traspaso_id: traspaso.id,
          producto_origen_id: item.producto_id,
          producto_destino_id: productoDestinoId,
          nombre_producto: item.nombre,
          cantidad: item.cantidad,
          costo_unitario: item.costo_unitario
        })
      }

      setShowNuevoTraspaso(false)
      setTraspasoExitoso(numeroTraspaso)
      setShowExito(true)
      setTimeout(() => {
        setShowExito(false)
        setTraspasoExitoso(null)
      }, 3000)

      loadData()

    } catch (err) {
      console.error('Error guardando traspaso:', err)
      setError('Error al procesar el traspaso')
    } finally {
      setGuardando(false)
    }
  }

  // Exportar a Excel
  const exportarExcel = () => {
    if (traspasos.length === 0) return

    const datosExcel: any[] = []
    traspasos.forEach(traspaso => {
      traspaso.detalles.forEach(detalle => {
        datosExcel.push({
          'Traspaso #': traspaso.numero_traspaso,
          'Fecha': formatDateTime(traspaso.created_at),
          'Origen': traspaso.sucursal_origen_nombre,
          'Destino': traspaso.sucursal_destino_nombre,
          'Producto': detalle.nombre_producto,
          'Cantidad': detalle.cantidad,
          'Costo Unit.': detalle.costo_unitario,
          'Costo Total': detalle.cantidad * detalle.costo_unitario,
          'Usuario': traspaso.usuario_nombre,
          'Estado': traspaso.estado
        })
      })
    })

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(datosExcel)
    XLSX.utils.book_append_sheet(wb, ws, 'Traspasos')
    XLSX.writeFile(wb, 'Traspasos.xlsx')
  }

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

  if (!tienePermiso) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">Acceso restringido</h3>
          <p className="text-gray-500">Solo los gerentes pueden realizar traspasos entre sucursales.</p>
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Traspaso Completado!</h2>
            <p className="text-emerald-600 text-lg font-medium">Traspaso #{traspasoExitoso}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Traspasos</h1>
          <p className="text-gray-500 text-sm">Transferir productos entre sucursales</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportarExcel}
            disabled={traspasos.length === 0}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <button
            onClick={abrirNuevoTraspaso}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Nuevo Traspaso
          </button>
        </div>
      </div>

      {error && !showNuevoTraspaso && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Info sucursal actual */}
      {sucursalActual && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Sucursal actual: <strong>{sucursalActual.nombre}</strong>
          {sucursales.length > 0 && (
            <span className="ml-2">• {sucursales.length} sucursal(es) disponible(s) para traspasar</span>
          )}
        </div>
      )}

      {/* Lista de traspasos */}
      {traspasos.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No hay traspasos</h3>
          <p className="text-gray-500">No se han realizado traspasos entre sucursales</p>
        </div>
      ) : (
        <div className="space-y-3">
          {traspasos.map(traspaso => (
            <div
              key={traspaso.id}
              onClick={() => setTraspasoSeleccionado(traspaso)}
              className="bg-white rounded-xl border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">Traspaso #{traspaso.numero_traspaso}</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      traspaso.estado === 'completado' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {traspaso.estado === 'completado' ? 'Completado' : 'Anulado'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                    <span>{traspaso.sucursal_origen_nombre}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <span>{traspaso.sucursal_destino_nombre}</span>
                  </div>
                  <p className="text-gray-400 text-xs mt-1">{formatDateTime(traspaso.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">{traspaso.total_items} unidades</p>
                  <p className="text-sm text-gray-500">{formatCurrency(traspaso.total_costo)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal nuevo traspaso */}
      {showNuevoTraspaso && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Nuevo Traspaso</h2>
                <button onClick={() => setShowNuevoTraspaso(false)} className="text-gray-400 hover:text-gray-600">
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

              {/* Origen y Destino */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Origen</label>
                  <div className="px-4 py-2 bg-gray-100 rounded-xl text-gray-700">
                    {sucursalActual?.nombre}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Destino *</label>
                  <select
                    value={sucursalDestinoId}
                    onChange={e => setSucursalDestinoId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-white"
                  >
                    <option value="">Seleccionar...</option>
                    {sucursales.map(suc => (
                      <option key={suc.id} value={suc.id}>{suc.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Agregar productos */}
              <div className="border border-gray-200 rounded-xl p-4">
                <h3 className="font-medium text-gray-900 mb-3">Agregar producto</h3>
                <div className="space-y-2">
                  <select
                    value={productoSeleccionado}
                    onChange={e => setProductoSeleccionado(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm"
                  >
                    <option value="">Seleccionar producto...</option>
                    {productos.map(prod => (
                      <option key={prod.id} value={prod.id}>
                        {prod.nombre} (Stock: {prod.stock_actual})
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={cantidadItem}
                      onChange={e => setCantidadItem(e.target.value)}
                      placeholder="Cantidad"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      min="1"
                    />
                    <button
                      onClick={agregarItem}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                    >
                      Agregar
                    </button>
                  </div>
                </div>
              </div>

              {/* Lista de items */}
              {items.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-900">Productos a traspasar ({items.length})</h3>
                  {items.map(item => (
                    <div key={item.producto_id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-900">{item.nombre}</p>
                        <p className="text-xs text-gray-500">
                          {item.cantidad} unidades × {formatCurrency(item.costo_unitario)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {formatCurrency(item.cantidad * item.costo_unitario)}
                        </span>
                        <button
                          onClick={() => eliminarItem(item.producto_id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total: {totalUnidades} unidades</span>
                    <span>{formatCurrency(totalTraspaso)}</span>
                  </div>
                </div>
              )}

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl resize-none"
                  rows={2}
                  placeholder="Observaciones del traspaso..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowNuevoTraspaso(false)}
                className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={guardarTraspaso}
                disabled={guardando || items.length === 0 || !sucursalDestinoId}
                className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-xl font-medium disabled:opacity-50"
              >
                {guardando ? 'Procesando...' : 'Confirmar Traspaso'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle traspaso */}
      {traspasoSeleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Traspaso #{traspasoSeleccionado.numero_traspaso}</h2>
                  <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
                    traspasoSeleccionado.estado === 'completado' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {traspasoSeleccionado.estado === 'completado' ? 'Completado' : 'Anulado'}
                  </span>
                </div>
                <button onClick={() => setTraspasoSeleccionado(null)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Ruta del traspaso */}
              <div className="flex items-center justify-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{traspasoSeleccionado.sucursal_origen_nombre}</p>
                  <p className="text-xs text-gray-500">Origen</p>
                </div>
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <div className="text-center">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{traspasoSeleccionado.sucursal_destino_nombre}</p>
                  <p className="text-xs text-gray-500">Destino</p>
                </div>
              </div>

              {/* Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Fecha</span>
                  <p className="font-medium">{formatDateTime(traspasoSeleccionado.created_at)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Realizado por</span>
                  <p className="font-medium">{traspasoSeleccionado.usuario_nombre}</p>
                </div>
              </div>

              {/* Productos */}
              <div className="border-t border-gray-100 pt-4">
                <h3 className="font-medium text-gray-900 mb-3">Productos ({traspasoSeleccionado.detalles.length})</h3>
                <div className="space-y-2">
                  {traspasoSeleccionado.detalles.map(detalle => (
                    <div key={detalle.id} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{detalle.nombre_producto}</p>
                        <p className="text-xs text-gray-500">
                          {detalle.cantidad} × {formatCurrency(detalle.costo_unitario)}
                        </p>
                      </div>
                      <p className="font-medium text-gray-900">
                        {formatCurrency(detalle.cantidad * detalle.costo_unitario)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totales */}
              <div className="flex justify-between font-bold text-lg pt-4 border-t border-gray-100">
                <span>Total: {traspasoSeleccionado.total_items} unidades</span>
                <span>{formatCurrency(traspasoSeleccionado.total_costo)}</span>
              </div>

              {traspasoSeleccionado.notas && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700"><strong>Notas:</strong> {traspasoSeleccionado.notas}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100">
              <button
                onClick={() => setTraspasoSeleccionado(null)}
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