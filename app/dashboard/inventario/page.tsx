'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { formatCurrency } from '@/lib/utils/format'
import { formatDateTime } from '@/lib/utils/timezone'

interface Producto {
  id: string
  nombre: string
  codigo: string
  categoria_nombre: string
}

interface InventarioDetalle {
  id: string
  producto_id: string
  stock_sistema: number
  stock_contado: number | null
  diferencia: number
  costo_diferencia: number
  costo_unitario: number
  contado: boolean
  notas: string | null
  producto: Producto
}

interface Inventario {
  id: string
  fecha_inicio: string
  fecha_cierre: string | null
  estado: 'en_proceso' | 'completado' | 'cancelado'
  total_productos: number
  productos_contados: number
  productos_con_diferencia: number
  notas: string | null
  usuario_nombre: string
}

export default function InventarioPage() {
  const [inventarioActivo, setInventarioActivo] = useState<Inventario | null>(null)
  const [detalles, setDetalles] = useState<InventarioDetalle[]>([])
  const [historial, setHistorial] = useState<Inventario[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [iniciando, setIniciando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  
  // Filtros y búsqueda
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'pendientes' | 'contados' | 'diferencias'>('todos')
  
  // Modal de historial
  const [showHistorial, setShowHistorial] = useState(false)
  const [inventarioDetalle, setInventarioDetalle] = useState<Inventario | null>(null)
  const [detallesHistorial, setDetallesHistorial] = useState<InventarioDetalle[]>([])

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
      // Buscar inventario en proceso
      const { data: inventarioData } = await supabase
        .from('inventarios')
        .select(`
          *,
          usuario:usuarios(nombre)
        `)
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('estado', 'en_proceso')
        .maybeSingle()

      if (inventarioData) {
        setInventarioActivo({
          ...inventarioData,
          usuario_nombre: inventarioData.usuario?.nombre || 'Desconocido'
        })

        // Cargar detalles del inventario
        const { data: detallesData } = await supabase
          .from('inventario_detalles')
          .select(`
            *,
            producto:productos(id, nombre, codigo, categoria:categorias(nombre))
          `)
          .eq('inventario_id', inventarioData.id)
          .order('contado', { ascending: true })

        if (detallesData) {
          setDetalles(detallesData.map(d => ({
            ...d,
            producto: {
              id: d.producto?.id || '',
              nombre: d.producto?.nombre || 'Producto eliminado',
              codigo: d.producto?.codigo || '',
              categoria_nombre: d.producto?.categoria?.nombre || 'Sin categoría'
            }
          })))
        }
      } else {
        setInventarioActivo(null)
        setDetalles([])
      }

      // Cargar historial de inventarios
      const { data: historialData } = await supabase
        .from('inventarios')
        .select(`
          *,
          usuario:usuarios(nombre)
        `)
        .eq('sucursal_id', usuario.sucursal_id)
        .neq('estado', 'en_proceso')
        .order('fecha_inicio', { ascending: false })
        .limit(20)

      if (historialData) {
        setHistorial(historialData.map(h => ({
          ...h,
          usuario_nombre: h.usuario?.nombre || 'Desconocido'
        })))
      }

    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }

  // Filtrar detalles
  const detallesFiltrados = useMemo(() => {
    let resultado = detalles

    // Filtrar por búsqueda
    if (busqueda) {
      const termino = busqueda.toLowerCase()
      resultado = resultado.filter(d =>
        d.producto.nombre.toLowerCase().includes(termino) ||
        d.producto.codigo?.toLowerCase().includes(termino)
      )
    }

    // Filtrar por estado
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

  // Estadísticas
  const estadisticas = useMemo(() => {
    const contados = detalles.filter(d => d.contado).length
    const conDiferencia = detalles.filter(d => d.contado && d.diferencia !== 0).length
    const diferenciaSobrante = detalles
      .filter(d => d.contado && d.diferencia > 0)
      .reduce((sum, d) => sum + d.costo_diferencia, 0)
    const diferenciaFaltante = detalles
      .filter(d => d.contado && d.diferencia < 0)
      .reduce((sum, d) => sum + Math.abs(d.costo_diferencia), 0)

    return {
      total: detalles.length,
      contados,
      pendientes: detalles.length - contados,
      conDiferencia,
      diferenciaSobrante,
      diferenciaFaltante
    }
  }, [detalles])

  // Iniciar nuevo inventario
  const iniciarInventario = async () => {
    if (!usuario?.sucursal_id || !usuario?.id) return

    if (!confirm('¿Iniciar un nuevo conteo de inventario?\n\nEsto creará una lista de todos los productos para contar.')) {
      return
    }

    setIniciando(true)
    try {
      const { data, error } = await supabase.rpc('iniciar_inventario', {
        p_sucursal_id: usuario.sucursal_id,
        p_usuario_id: usuario.id,
        p_notas: null
      })

      if (error) throw error

      await loadData()
    } catch (err: any) {
      console.error('Error iniciando inventario:', err)
      alert(err.message || 'Error al iniciar el inventario')
    } finally {
      setIniciando(false)
    }
  }

  // Actualizar conteo de un producto
  const actualizarConteo = async (detalleId: string, stockContado: number | null) => {
    setGuardando(true)
    try {
      const { error } = await supabase
        .from('inventario_detalles')
        .update({
          stock_contado: stockContado,
          contado: stockContado !== null
        })
        .eq('id', detalleId)

      if (error) throw error

      // Actualizar estado local
      setDetalles(prev => prev.map(d =>
        d.id === detalleId
          ? { 
              ...d, 
              stock_contado: stockContado, 
              contado: stockContado !== null,
              diferencia: (stockContado ?? 0) - d.stock_sistema,
              costo_diferencia: ((stockContado ?? 0) - d.stock_sistema) * d.costo_unitario
            }
          : d
      ))
    } catch (err) {
      console.error('Error actualizando conteo:', err)
      alert('Error al guardar el conteo')
    } finally {
      setGuardando(false)
    }
  }

  // Aplicar ajustes
  const aplicarAjustes = async () => {
    if (!inventarioActivo) return

    const contados = detalles.filter(d => d.contado).length
    const conDiferencia = detalles.filter(d => d.contado && d.diferencia !== 0).length

    if (contados === 0) {
      alert('No hay productos contados para aplicar ajustes')
      return
    }

    const mensaje = conDiferencia > 0
      ? `¿Aplicar ajustes al inventario?\n\n` +
        `• Productos contados: ${contados}\n` +
        `• Con diferencias: ${conDiferencia}\n\n` +
        `Esto actualizará el stock de todos los productos contados.`
      : `¿Finalizar inventario?\n\n` +
        `• Productos contados: ${contados}\n` +
        `• Sin diferencias encontradas\n\n` +
        `Esto cerrará el inventario actual.`

    if (!confirm(mensaje)) return

    setAplicando(true)
    try {
      const { error } = await supabase.rpc('aplicar_ajustes_inventario', {
        p_inventario_id: inventarioActivo.id
      })

      if (error) throw error

      alert('¡Inventario completado! Los ajustes se aplicaron correctamente.')
      await loadData()
    } catch (err: any) {
      console.error('Error aplicando ajustes:', err)
      alert(err.message || 'Error al aplicar los ajustes')
    } finally {
      setAplicando(false)
    }
  }

  // Cancelar inventario
  const cancelarInventario = async () => {
    if (!inventarioActivo) return

    if (!confirm('¿Cancelar el inventario en proceso?\n\nNo se aplicarán cambios al stock.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('inventarios')
        .update({ estado: 'cancelado', fecha_cierre: new Date().toISOString() })
        .eq('id', inventarioActivo.id)

      if (error) throw error

      await loadData()
    } catch (err) {
      console.error('Error cancelando inventario:', err)
      alert('Error al cancelar el inventario')
    }
  }

  // Ver detalle de inventario histórico
  const verDetalleHistorial = async (inventario: Inventario) => {
    setInventarioDetalle(inventario)
    
    const { data } = await supabase
      .from('inventario_detalles')
      .select(`
        *,
        producto:productos(id, nombre, codigo, categoria:categorias(nombre))
      `)
      .eq('inventario_id', inventario.id)
      .eq('contado', true)
      .order('diferencia', { ascending: true })

    if (data) {
      setDetallesHistorial(data.map(d => ({
        ...d,
        producto: {
          id: d.producto?.id || '',
          nombre: d.producto?.nombre || 'Producto eliminado',
          codigo: d.producto?.codigo || '',
          categoria_nombre: d.producto?.categoria?.nombre || 'Sin categoría'
        }
      })))
    }
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

  // Vista cuando no hay inventario activo
  if (!inventarioActivo) {
    return (
      <div className="p-4 pb-24 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
            <p className="text-gray-500 text-sm">Conteo físico de productos</p>
          </div>
          <button
            onClick={() => setShowHistorial(true)}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>

        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Iniciar Conteo de Inventario</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Realiza un conteo físico de todos tus productos y ajusta las diferencias automáticamente.
          </p>
          <button
            onClick={iniciarInventario}
            disabled={iniciando}
            className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 disabled:opacity-50"
          >
            {iniciando ? 'Iniciando...' : 'Iniciar Inventario'}
          </button>
        </div>

        {/* Historial reciente */}
        {historial.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Inventarios Anteriores</h2>
            <div className="space-y-3">
              {historial.slice(0, 5).map(inv => (
                <div
                  key={inv.id}
                  onClick={() => verDetalleHistorial(inv)}
                  className="bg-white rounded-xl border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {formatDateTime(inv.fecha_inicio)}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          inv.estado === 'completado' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {inv.estado === 'completado' ? 'Completado' : 'Cancelado'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {inv.productos_contados} productos contados • {inv.productos_con_diferencia} con diferencias
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal historial completo */}
        {showHistorial && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
                <h2 className="text-xl font-bold text-gray-900">Historial de Inventarios</h2>
                <button onClick={() => setShowHistorial(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                {historial.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No hay inventarios anteriores</p>
                ) : (
                  <div className="space-y-3">
                    {historial.map(inv => (
                      <div
                        key={inv.id}
                        onClick={() => {
                          setShowHistorial(false)
                          verDetalleHistorial(inv)
                        }}
                        className="bg-gray-50 rounded-xl p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{formatDateTime(inv.fecha_inicio)}</p>
                            <p className="text-sm text-gray-500">
                              Por: {inv.usuario_nombre}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`px-2 py-0.5 text-xs rounded-full ${
                              inv.estado === 'completado' 
                                ? 'bg-emerald-100 text-emerald-700' 
                                : 'bg-gray-200 text-gray-700'
                            }`}>
                              {inv.estado === 'completado' ? 'Completado' : 'Cancelado'}
                            </span>
                            <p className="text-sm text-gray-500 mt-1">
                              {inv.productos_con_diferencia} diferencias
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal detalle de inventario histórico */}
        {inventarioDetalle && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-100 sticky top-0 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Detalle de Inventario</h2>
                    <p className="text-sm text-gray-500">{formatDateTime(inventarioDetalle.fecha_inicio)}</p>
                  </div>
                  <button onClick={() => setInventarioDetalle(null)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-6">
                {/* Resumen */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">{inventarioDetalle.productos_contados}</p>
                    <p className="text-sm text-gray-500">Contados</p>
                  </div>
                  <div className="bg-yellow-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-yellow-600">{inventarioDetalle.productos_con_diferencia}</p>
                    <p className="text-sm text-gray-500">Con diferencias</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-600">
                      {inventarioDetalle.productos_contados - inventarioDetalle.productos_con_diferencia}
                    </p>
                    <p className="text-sm text-gray-500">Sin diferencias</p>
                  </div>
                </div>

                {/* Lista de diferencias */}
                {detallesHistorial.filter(d => d.diferencia !== 0).length > 0 ? (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Productos con diferencias</h3>
                    <div className="space-y-2">
                      {detallesHistorial
                        .filter(d => d.diferencia !== 0)
                        .map(d => (
                          <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <p className="font-medium text-gray-900">{d.producto.nombre}</p>
                              <p className="text-xs text-gray-500">
                                Sistema: {d.stock_sistema} → Contado: {d.stock_contado}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`font-bold ${d.diferencia > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {d.diferencia > 0 ? '+' : ''}{d.diferencia}
                              </p>
                              <p className={`text-xs ${d.costo_diferencia > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {formatCurrency(Math.abs(d.costo_diferencia))}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-4">No se encontraron diferencias en este inventario</p>
                )}
              </div>
              <div className="p-6 border-t border-gray-100">
                <button
                  onClick={() => setInventarioDetalle(null)}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200"
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

  // Vista de inventario activo
  return (
    <div className="p-4 pb-24 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario en Proceso</h1>
          <p className="text-gray-500 text-sm">Iniciado: {formatDateTime(inventarioActivo.fecha_inicio)}</p>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-xl font-bold text-gray-900">{estadisticas.total}</p>
          <p className="text-xs text-gray-500">Total</p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-3 text-center">
          <p className="text-xl font-bold text-emerald-600">{estadisticas.contados}</p>
          <p className="text-xs text-gray-500">Contados</p>
        </div>
        <div className="bg-yellow-50 rounded-xl border border-yellow-100 p-3 text-center">
          <p className="text-xl font-bold text-yellow-600">{estadisticas.pendientes}</p>
          <p className="text-xs text-gray-500">Pendientes</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-100 p-3 text-center">
          <p className="text-xl font-bold text-red-600">{estadisticas.conDiferencia}</p>
          <p className="text-xs text-gray-500">Diferencias</p>
        </div>
      </div>

      {/* Resumen de diferencias */}
      {estadisticas.conDiferencia > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <h3 className="font-medium text-gray-900 mb-2">Resumen de Diferencias</h3>
          <div className="flex gap-4">
            <div className="flex-1">
              <p className="text-sm text-gray-500">Sobrantes</p>
              <p className="text-lg font-bold text-emerald-600">+{formatCurrency(estadisticas.diferenciaSobrante)}</p>
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-500">Faltantes</p>
              <p className="text-lg font-bold text-red-600">-{formatCurrency(estadisticas.diferenciaFaltante)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Búsqueda y filtros */}
      <div className="space-y-3 mb-4">
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar producto..."
          className="w-full px-4 py-2 border border-gray-200 rounded-xl"
        />
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { key: 'todos', label: 'Todos' },
            { key: 'pendientes', label: `Pendientes (${estadisticas.pendientes})` },
            { key: 'contados', label: `Contados (${estadisticas.contados})` },
            { key: 'diferencias', label: `Diferencias (${estadisticas.conDiferencia})` },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key as any)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filtro === f.key
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de productos */}
      <div className="space-y-2 mb-6">
        {detallesFiltrados.map(detalle => (
          <div
            key={detalle.id}
            className={`bg-white rounded-xl border p-4 ${
              detalle.contado
                ? detalle.diferencia !== 0
                  ? 'border-yellow-300'
                  : 'border-emerald-300'
                : 'border-gray-100'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{detalle.producto.nombre}</p>
                <p className="text-xs text-gray-500">
                  {detalle.producto.codigo && `${detalle.producto.codigo} • `}
                  {detalle.producto.categoria_nombre}
                </p>
                <div className="flex items-center gap-4 mt-2">
                  <div>
                    <p className="text-xs text-gray-500">Sistema</p>
                    <p className="font-bold text-gray-900">{detalle.stock_sistema}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">Conteo físico</p>
                    <input
                      type="number"
                      value={detalle.stock_contado ?? ''}
                      onChange={e => {
                        const val = e.target.value
                        actualizarConteo(detalle.id, val === '' ? null : parseInt(val))
                      }}
                      placeholder="0"
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-center font-bold"
                      min="0"
                    />
                  </div>
                  {detalle.contado && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Diferencia</p>
                      <p className={`font-bold ${
                        detalle.diferencia > 0
                          ? 'text-emerald-600'
                          : detalle.diferencia < 0
                            ? 'text-red-600'
                            : 'text-gray-600'
                      }`}>
                        {detalle.diferencia > 0 ? '+' : ''}{detalle.diferencia}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {detalle.contado && (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  detalle.diferencia === 0 ? 'bg-emerald-100' : 'bg-yellow-100'
                }`}>
                  <svg className={`w-5 h-5 ${
                    detalle.diferencia === 0 ? 'text-emerald-600' : 'text-yellow-600'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        ))}

        {detallesFiltrados.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No se encontraron productos con este filtro
          </div>
        )}
      </div>

      {/* Barra de acciones fija */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-100 p-4 flex gap-3">
        <button
          onClick={cancelarInventario}
          className="px-4 py-3 border border-gray-200 text-gray-700 rounded-xl flex-1"
        >
          Cancelar
        </button>
        <button
          onClick={aplicarAjustes}
          disabled={aplicando || estadisticas.contados === 0}
          className="px-4 py-3 bg-emerald-500 text-white rounded-xl font-medium flex-1 disabled:opacity-50"
        >
          {aplicando ? 'Aplicando...' : `Finalizar (${estadisticas.contados} contados)`}
        </button>
      </div>

      {/* Indicador de guardado */}
      {guardando && (
        <div className="fixed top-4 right-4 bg-black/80 text-white px-3 py-2 rounded-lg text-sm">
          Guardando...
        </div>
      )}
    </div>
  )
}