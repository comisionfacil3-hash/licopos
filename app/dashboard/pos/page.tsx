'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { formatCurrency } from '@/lib/utils/format'
import { Producto, Categoria, Cliente } from '@/types/database'

interface ItemCarrito {
  producto: Producto
  cantidad: number
  precio_unitario: number
  subtotal: number
}

export default function POSPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('todas')
  const [cajaAbierta, setCajaAbierta] = useState<boolean>(false)
  const [cajaId, setCajaId] = useState<string | null>(null)
  
  // Estados para cobro
  const [showCobrar, setShowCobrar] = useState(false)
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'qr' | 'credito' | 'mixto'>('efectivo')
  const [montoRecibido, setMontoRecibido] = useState('')
  const [montoEfectivo, setMontoEfectivo] = useState('')
  const [montoQR, setMontoQR] = useState('')
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string>('')
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')
  
  // Estado para edición de precio
  const [editandoPrecio, setEditandoPrecio] = useState<string | null>(null)
  const [nuevoPrecio, setNuevoPrecio] = useState('')
  
  // Estado para mensaje de éxito
  const [showExito, setShowExito] = useState(false)
  const [ventaExitosa, setVentaExitosa] = useState<number | null>(null)

  const router = useRouter()
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
      // Verificar caja abierta
      const { data: cajaData } = await supabase
        .from('cajas')
        .select('id')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('estado', 'abierta')
        .maybeSingle()

      setCajaAbierta(!!cajaData)
      setCajaId(cajaData?.id || null)

      // Cargar productos
      const { data: productosData } = await supabase
        .from('productos')
        .select('*')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('activo', true)
        .order('nombre')

      setProductos(productosData || [])

      // Cargar categorias
      const { data: categoriasData } = await supabase
        .from('categorias')
        .select('*')
        .eq('empresa_id', usuario.empresa_id)
        .eq('activa', true)
        .order('orden')

      setCategorias(categoriasData || [])

      // Cargar clientes
      const { data: clientesData } = await supabase
        .from('clientes')
        .select('*')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('activo', true)
        .order('nombre')

      setClientes(clientesData || [])
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }

  // Filtrar productos
  const productosFiltrados = useMemo(() => {
    let resultado = [...productos]

    if (searchTerm.trim()) {
      const termino = searchTerm.toLowerCase()
      resultado = resultado.filter(p =>
        p.nombre.toLowerCase().includes(termino) ||
        p.codigo?.toLowerCase().includes(termino) ||
        p.codigo_barras?.toLowerCase().includes(termino)
      )
    }

    if (categoriaSeleccionada !== 'todas') {
      resultado = resultado.filter(p => p.categoria_id === categoriaSeleccionada)
    }

    return resultado
  }, [productos, searchTerm, categoriaSeleccionada])

  // Calcular total del carrito
  const totalCarrito = useMemo(() => {
    return carrito.reduce((sum, item) => sum + item.subtotal, 0)
  }, [carrito])

  // Agregar al carrito
  const agregarAlCarrito = (producto: Producto) => {
    if (producto.stock_actual <= 0) return

    setCarrito(prev => {
      const existente = prev.find(item => item.producto.id === producto.id)
      
      if (existente) {
        if (existente.cantidad >= producto.stock_actual) return prev
        
        return prev.map(item =>
          item.producto.id === producto.id
            ? {
                ...item,
                cantidad: item.cantidad + 1,
                subtotal: (item.cantidad + 1) * item.precio_unitario
              }
            : item
        )
      }

      return [...prev, {
        producto,
        cantidad: 1,
        precio_unitario: producto.precio_venta,
        subtotal: producto.precio_venta
      }]
    })
  }

  // Actualizar cantidad
  const actualizarCantidad = (productoId: string, nuevaCantidad: number) => {
    if (nuevaCantidad <= 0) {
      setCarrito(prev => prev.filter(item => item.producto.id !== productoId))
      return
    }

    setCarrito(prev =>
      prev.map(item => {
        if (item.producto.id !== productoId) return item
        
        const cantidad = Math.min(nuevaCantidad, item.producto.stock_actual)
        return {
          ...item,
          cantidad,
          subtotal: cantidad * item.precio_unitario
        }
      })
    )
  }

  // Actualizar precio (para descuentos)
  const actualizarPrecio = (productoId: string) => {
    const precio = parseFloat(nuevoPrecio)
    if (isNaN(precio) || precio < 0) {
      setEditandoPrecio(null)
      setNuevoPrecio('')
      return
    }

    setCarrito(prev =>
      prev.map(item => {
        if (item.producto.id !== productoId) return item
        return {
          ...item,
          precio_unitario: precio,
          subtotal: item.cantidad * precio
        }
      })
    )
    
    setEditandoPrecio(null)
    setNuevoPrecio('')
  }

  // Eliminar del carrito
  const eliminarDelCarrito = (productoId: string) => {
    setCarrito(prev => prev.filter(item => item.producto.id !== productoId))
  }

  // Limpiar carrito
  const limpiarCarrito = () => {
    setCarrito([])
  }

  // Abrir modal de cobro
  const abrirCobrar = () => {
    if (carrito.length === 0) return
    setMetodoPago('efectivo')
    setMontoRecibido('')
    setMontoEfectivo('')
    setMontoQR('')
    setClienteSeleccionado('')
    setError('')
    setShowCobrar(true)
  }

  // Procesar venta
  const procesarVenta = async () => {
    if (!usuario?.sucursal_id || !usuario?.id || !cajaId) return

    // Validaciones
    if (metodoPago === 'credito' && !clienteSeleccionado) {
      setError('Debe seleccionar un cliente para ventas a crédito')
      return
    }

    if (metodoPago === 'mixto') {
      const efectivo = parseFloat(montoEfectivo) || 0
      const qr = parseFloat(montoQR) || 0
      if (Math.abs((efectivo + qr) - totalCarrito) > 0.01) {
        setError('Los montos deben sumar el total exacto')
        return
      }
    }

    setProcesando(true)
    setError('')

    try {
      // Obtener numero de venta
      const { data: maxVenta } = await supabase
        .from('ventas')
        .select('numero_venta')
        .eq('sucursal_id', usuario.sucursal_id)
        .order('numero_venta', { ascending: false })
        .limit(1)
        .maybeSingle()

      const numeroVenta = (maxVenta?.numero_venta || 0) + 1

      // Calcular montos segun metodo
      let montoEfectivoFinal = 0
      let montoQRFinal = 0
      let montoCreditoFinal = 0

      switch (metodoPago) {
        case 'efectivo':
          montoEfectivoFinal = totalCarrito
          break
        case 'qr':
          montoQRFinal = totalCarrito
          break
        case 'credito':
          montoCreditoFinal = totalCarrito
          break
        case 'mixto':
          montoEfectivoFinal = parseFloat(montoEfectivo) || 0
          montoQRFinal = parseFloat(montoQR) || 0
          break
      }

      // Crear venta
      const { data: venta, error: ventaError } = await supabase
        .from('ventas')
        .insert({
          sucursal_id: usuario.sucursal_id,
          caja_id: cajaId,
          usuario_id: usuario.id,
          cliente_id: clienteSeleccionado || null,
          numero_venta: numeroVenta,
          subtotal: totalCarrito,
          descuento: 0,
          total: totalCarrito,
          metodo_pago: metodoPago,
          monto_efectivo: montoEfectivoFinal,
          monto_qr: montoQRFinal,
          monto_credito: montoCreditoFinal,
          estado: 'completada'
        })
        .select()
        .single()

      if (ventaError) throw ventaError

      // Crear detalles de venta
      const detalles = carrito.map(item => ({
        venta_id: venta.id,
        producto_id: item.producto.id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        precio_original: item.producto.precio_venta,
        costo_unitario: item.producto.precio_compra,
        subtotal: item.subtotal
      }))

      const { error: detallesError } = await supabase
        .from('venta_detalles')
        .insert(detalles)

      if (detallesError) throw detallesError

      // Actualizar stock de productos
      for (const item of carrito) {
        await supabase
          .from('productos')
          .update({ stock_actual: item.producto.stock_actual - item.cantidad })
          .eq('id', item.producto.id)
      }

      // Registrar movimientos en caja
      if (montoEfectivoFinal > 0) {
        await supabase.from('movimientos_caja').insert({
          caja_id: cajaId,
          tipo: 'ingreso',
          concepto: `Venta ${numeroVenta}`,
          referencia_id: venta.id,
          referencia_tipo: 'venta',
          monto: montoEfectivoFinal,
          metodo_pago: 'efectivo'
        })
      }

      if (montoQRFinal > 0) {
        await supabase.from('movimientos_caja').insert({
          caja_id: cajaId,
          tipo: 'ingreso',
          concepto: `Venta ${numeroVenta}`,
          referencia_id: venta.id,
          referencia_tipo: 'venta',
          monto: montoQRFinal,
          metodo_pago: 'qr'
        })
      }

      // Limpiar y mostrar éxito
      setShowCobrar(false)
      limpiarCarrito()
      setVentaExitosa(numeroVenta)
      setShowExito(true)
      
      // Recargar datos
      loadData()

      // Ocultar mensaje después de 3 segundos
      setTimeout(() => {
        setShowExito(false)
        setVentaExitosa(null)
      }, 3000)

    } catch (err) {
      console.error('Error procesando venta:', err)
      setError('Error al procesar la venta')
    } finally {
      setProcesando(false)
    }
  }

  // Calcular cambio
  const cambio = useMemo(() => {
    if (metodoPago !== 'efectivo') return 0
    const recibido = parseFloat(montoRecibido) || 0
    return Math.max(0, recibido - totalCarrito)
  }, [metodoPago, montoRecibido, totalCarrito])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!cajaAbierta) {
    return (
      <div className="p-4 pb-24 max-w-4xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-amber-900 mb-2">Caja Cerrada</h3>
          <p className="text-amber-700 mb-4">Debe abrir la caja antes de realizar ventas</p>
          <button
            onClick={() => router.push('/dashboard/caja')}
            className="px-6 py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 font-medium"
          >
            Ir a Caja
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      {/* Mensaje de éxito */}
      {showExito && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full animate-bounce-in">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Venta Exitosa!</h2>
            <p className="text-emerald-600 text-lg font-medium">Venta #{ventaExitosa}</p>
            <p className="text-gray-500 mt-2">registrada correctamente</p>
          </div>
        </div>
      )}

      {/* Buscador y filtros */}
      <div className="p-4 bg-white border-b border-gray-100">
        <input
          type="text"
          placeholder="Buscar producto..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none mb-3"
        />
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setCategoriaSeleccionada('todas')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
              categoriaSeleccionada === 'todas'
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            Todas
          </button>
          {categorias.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategoriaSeleccionada(cat.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                categoriaSeleccionada === cat.id
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {cat.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de productos */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {productosFiltrados.map(producto => (
            <div
              key={producto.id}
              onClick={() => agregarAlCarrito(producto)}
              className={`bg-white rounded-xl border overflow-hidden cursor-pointer transition-all ${
                producto.stock_actual <= 0
                  ? 'border-red-200 opacity-50 cursor-not-allowed'
                  : 'border-gray-100 hover:shadow-lg hover:border-emerald-200'
              }`}
            >
              {/* Imagen del producto */}
              <div className="w-full h-24 bg-gray-100 relative">
                {producto.imagen_url ? (
                  <img
                    src={producto.imagen_url}
                    alt={producto.nombre}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                {producto.stock_actual <= 0 && (
                  <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center">
                    <span className="text-white font-bold text-xs">SIN STOCK</span>
                  </div>
                )}
              </div>
              <div className="p-2">
                <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-1">
                  {producto.nombre}
                </h3>
                <p className="text-emerald-600 font-bold">
                  {formatCurrency(producto.precio_venta)}
                </p>
                <p className={`text-xs mt-1 ${
                  producto.stock_actual <= 0 ? 'text-red-500' : 
                  producto.stock_actual <= producto.stock_minimo ? 'text-amber-500' : 'text-gray-400'
                }`}>
                  Stock: {producto.stock_actual}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Carrito fijo abajo */}
      {carrito.length > 0 && (
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-600">
              {carrito.length} items | {carrito.reduce((sum, i) => sum + i.cantidad, 0)} unidades
            </span>
            <button
              onClick={limpiarCarrito}
              className="text-red-500 text-sm"
            >
              Limpiar
            </button>
          </div>
          
          <div className="max-h-40 overflow-y-auto mb-3 space-y-2">
            {carrito.map(item => (
              <div key={item.producto.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* Mini imagen */}
                  <div className="w-10 h-10 bg-gray-200 rounded flex-shrink-0 overflow-hidden">
                    {item.producto.imagen_url ? (
                      <img src={item.producto.imagen_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.producto.nombre}</p>
                    {/* Precio editable */}
                    {editandoPrecio === item.producto.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={nuevoPrecio}
                          onChange={e => setNuevoPrecio(e.target.value)}
                          className="w-20 px-2 py-1 text-xs border rounded"
                          placeholder="Precio"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') actualizarPrecio(item.producto.id)
                            if (e.key === 'Escape') { setEditandoPrecio(null); setNuevoPrecio('') }
                          }}
                        />
                        <button
                          onClick={() => actualizarPrecio(item.producto.id)}
                          className="text-emerald-600 text-xs"
                        >
                          ✓
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditandoPrecio(item.producto.id)
                          setNuevoPrecio(item.precio_unitario.toString())
                        }}
                        className="text-xs text-gray-500 hover:text-emerald-600"
                      >
                        {formatCurrency(item.precio_unitario)} c/u
                        {item.precio_unitario !== item.producto.precio_venta && (
                          <span className="ml-1 text-amber-500">(editado)</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => actualizarCantidad(item.producto.id, item.cantidad - 1)}
                    className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center font-bold"
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-medium">{item.cantidad}</span>
                  <button
                    onClick={() => actualizarCantidad(item.producto.id, item.cantidad + 1)}
                    className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center font-bold"
                  >
                    +
                  </button>
                  <button
                    onClick={() => eliminarDelCarrito(item.producto.id)}
                    className="ml-2 text-red-500"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={abrirCobrar}
            className="w-full py-4 bg-emerald-500 text-white rounded-xl font-bold text-lg hover:bg-emerald-600"
          >
            Cobrar {formatCurrency(totalCarrito)}
          </button>
        </div>
      )}

      {/* Modal de cobro */}
      {showCobrar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Cobrar</h2>
              <p className="text-3xl font-bold text-emerald-600 mt-2">{formatCurrency(totalCarrito)}</p>
            </div>
            
            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Método de pago</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['efectivo', 'qr', 'credito', 'mixto'] as const).map(metodo => (
                    <button
                      key={metodo}
                      onClick={() => setMetodoPago(metodo)}
                      className={`py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
                        metodoPago === metodo
                          ? 'bg-emerald-500 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {metodo === 'efectivo' && '💵'}
                      {metodo === 'qr' && '📱'}
                      {metodo === 'credito' && '📝'}
                      {metodo === 'mixto' && '🔄'}
                      <span className="capitalize">{metodo === 'qr' ? 'QR' : metodo}</span>
                    </button>
                  ))}
                </div>
              </div>

              {metodoPago === 'efectivo' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto recibido</label>
                  <input
                    type="number"
                    value={montoRecibido}
                    onChange={e => setMontoRecibido(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg"
                    placeholder="0.00"
                  />
                  {cambio > 0 && (
                    <div className="mt-2 p-3 bg-emerald-50 rounded-lg">
                      <p className="text-lg font-bold text-emerald-600">
                        Cambio: {formatCurrency(cambio)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {metodoPago === 'credito' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                  <select
                    value={clienteSeleccionado}
                    onChange={e => setClienteSeleccionado(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white"
                  >
                    <option value="">Seleccionar cliente</option>
                    {clientes.map(cliente => (
                      <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>
                    ))}
                  </select>
                  {clientes.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      No hay clientes registrados. Cree uno primero.
                    </p>
                  )}
                </div>
              )}

              {metodoPago === 'mixto' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">💵 Efectivo</label>
                    <input
                      type="number"
                      value={montoEfectivo}
                      onChange={e => setMontoEfectivo(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">📱 QR</label>
                    <input
                      type="number"
                      value={montoQR}
                      onChange={e => setMontoQR(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                      placeholder="0.00"
                    />
                  </div>
                  <div className={`p-2 rounded-lg text-sm ${
                    Math.abs(((parseFloat(montoEfectivo) || 0) + (parseFloat(montoQR) || 0)) - totalCarrito) < 0.01
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}>
                    Suma: {formatCurrency((parseFloat(montoEfectivo) || 0) + (parseFloat(montoQR) || 0))}
                    {Math.abs(((parseFloat(montoEfectivo) || 0) + (parseFloat(montoQR) || 0)) - totalCarrito) >= 0.01 && (
                      <span className="ml-2">(debe ser {formatCurrency(totalCarrito)})</span>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowCobrar(false)}
                className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={procesarVenta}
                disabled={procesando}
                className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-xl font-medium disabled:opacity-50"
              >
                {procesando ? 'Procesando...' : 'Confirmar'}
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