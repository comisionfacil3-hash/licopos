'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { formatCurrency } from '@/lib/utils/format'
import jsPDF from 'jspdf'

interface Categoria {
  id: string
  nombre: string
}

interface Producto {
  id: string
  nombre: string
  codigo: string
  precio_venta: number
  stock_actual: number
  categoria_id: string | null
  imagen_url: string | null
}

interface ItemCotizacion {
  producto_id: string
  nombre: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

interface Sucursal {
  id: string
  nombre: string
  direccion: string | null
  telefono: string | null
}

export default function CotizacionPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [sucursal, setSucursal] = useState<Sucursal | null>(null)
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('')
  const [items, setItems] = useState<ItemCotizacion[]>([])
  const [showCarrito, setShowCarrito] = useState(false)
  const [clienteNombre, setClienteNombre] = useState('')
  const [validezDias, setValidezDias] = useState('7')
  const [notas, setNotas] = useState('')
  const [generandoPDF, setGenerandoPDF] = useState(false)

  const { usuario } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (usuario?.sucursal_id) {
      loadData()
    }
  }, [usuario?.sucursal_id])

  const loadData = async () => {
    if (!usuario?.sucursal_id || !usuario?.empresa_id) return

    setLoading(true)
    try {
      // Cargar sucursal
      const { data: sucursalData } = await supabase
        .from('sucursales')
        .select('id, nombre, direccion, telefono')
        .eq('id', usuario.sucursal_id)
        .single()

      setSucursal(sucursalData)

      // Cargar productos
      const { data: productosData } = await supabase
        .from('productos')
        .select('id, nombre, codigo, precio_venta, stock_actual, categoria_id, imagen_url')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('activo', true)
        .order('nombre')

      setProductos(productosData || [])

      // Cargar categorías
      const { data: categoriasData } = await supabase
        .from('categorias')
        .select('id, nombre')
        .eq('empresa_id', usuario.empresa_id)
        .eq('activa', true)
        .order('orden')

      setCategorias(categoriasData || [])

    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }

  // Filtrar productos
  const productosFiltrados = useMemo(() => {
    let resultado = productos

    if (busqueda) {
      const termino = busqueda.toLowerCase()
      resultado = resultado.filter(p =>
        p.nombre.toLowerCase().includes(termino) ||
        p.codigo?.toLowerCase().includes(termino)
      )
    }

    if (categoriaSeleccionada) {
      resultado = resultado.filter(p => p.categoria_id === categoriaSeleccionada)
    }

    return resultado
  }, [productos, busqueda, categoriaSeleccionada])

  // Total del carrito
  const totalCotizacion = items.reduce((sum, item) => sum + item.subtotal, 0)

  // Agregar producto al carrito
  const agregarProducto = (producto: Producto) => {
    const existente = items.find(i => i.producto_id === producto.id)
    
    if (existente) {
      setItems(prev => prev.map(i =>
        i.producto_id === producto.id
          ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precio_unitario }
          : i
      ))
    } else {
      setItems(prev => [...prev, {
        producto_id: producto.id,
        nombre: producto.nombre,
        cantidad: 1,
        precio_unitario: producto.precio_venta,
        subtotal: producto.precio_venta
      }])
    }
  }

  // Actualizar cantidad
  const actualizarCantidad = (productoId: string, nuevaCantidad: number) => {
    if (nuevaCantidad <= 0) {
      eliminarItem(productoId)
      return
    }
    setItems(prev => prev.map(i =>
      i.producto_id === productoId
        ? { ...i, cantidad: nuevaCantidad, subtotal: nuevaCantidad * i.precio_unitario }
        : i
    ))
  }

  // Actualizar precio
  const actualizarPrecio = (productoId: string, nuevoPrecio: number) => {
    if (nuevoPrecio < 0) return
    setItems(prev => prev.map(i =>
      i.producto_id === productoId
        ? { ...i, precio_unitario: nuevoPrecio, subtotal: i.cantidad * nuevoPrecio }
        : i
    ))
  }

  // Eliminar item
  const eliminarItem = (productoId: string) => {
    setItems(prev => prev.filter(i => i.producto_id !== productoId))
  }

  // Limpiar carrito
  const limpiarCarrito = () => {
    setItems([])
    setClienteNombre('')
    setNotas('')
    setValidezDias('7')
  }

  // Generar PDF
  const generarPDF = () => {
    if (items.length === 0) return

    setGenerandoPDF(true)

    try {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      let y = 20

      // Encabezado
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.text(sucursal?.nombre || 'Mi Licorería', pageWidth / 2, y, { align: 'center' })
      y += 8

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      if (sucursal?.direccion) {
        doc.text(sucursal.direccion, pageWidth / 2, y, { align: 'center' })
        y += 5
      }
      if (sucursal?.telefono) {
        doc.text(`Tel: ${sucursal.telefono}`, pageWidth / 2, y, { align: 'center' })
        y += 5
      }

      // Línea separadora
      y += 5
      doc.setLineWidth(0.5)
      doc.line(20, y, pageWidth - 20, y)
      y += 10

      // Título
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('COTIZACIÓN', pageWidth / 2, y, { align: 'center' })
      y += 10

      // Información
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      
      const fecha = new Date().toLocaleDateString('es-BO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      doc.text(`Fecha: ${fecha}`, 20, y)
      y += 6

      if (clienteNombre) {
        doc.text(`Cliente: ${clienteNombre}`, 20, y)
        y += 6
      }

      doc.text(`Válida por: ${validezDias} días`, 20, y)
      y += 10

      // Tabla de productos
      doc.setFillColor(240, 240, 240)
      doc.rect(20, y, pageWidth - 40, 8, 'F')
      
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Producto', 22, y + 5.5)
      doc.text('Cant.', 110, y + 5.5)
      doc.text('P. Unit.', 130, y + 5.5)
      doc.text('Subtotal', 160, y + 5.5)
      y += 12

      doc.setFont('helvetica', 'normal')
      items.forEach(item => {
        // Verificar si necesitamos nueva página
        if (y > 270) {
          doc.addPage()
          y = 20
        }

        const nombre = item.nombre.length > 40 
          ? item.nombre.substring(0, 40) + '...' 
          : item.nombre

        doc.text(nombre, 22, y)
        doc.text(item.cantidad.toString(), 115, y, { align: 'center' })
        doc.text(`Bs. ${item.precio_unitario.toFixed(2)}`, 145, y, { align: 'right' })
        doc.text(`Bs. ${item.subtotal.toFixed(2)}`, 185, y, { align: 'right' })
        y += 7
      })

      // Línea antes del total
      y += 3
      doc.line(100, y, pageWidth - 20, y)
      y += 8

      // Total
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text('TOTAL:', 130, y)
      doc.text(`Bs. ${totalCotizacion.toFixed(2)}`, 185, y, { align: 'right' })
      y += 15

      // Notas
      if (notas) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text('Notas:', 20, y)
        y += 5
        
        const notasLineas = doc.splitTextToSize(notas, pageWidth - 40)
        doc.text(notasLineas, 20, y)
        y += notasLineas.length * 5 + 5
      }

      // Pie de página
      y = 280
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.text('Esta cotización no representa un compromiso de venta.', pageWidth / 2, y, { align: 'center' })
      doc.text('Precios sujetos a cambio sin previo aviso.', pageWidth / 2, y + 4, { align: 'center' })

      // Descargar
      const nombreArchivo = clienteNombre 
        ? `Cotizacion_${clienteNombre.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
        : `Cotizacion_${new Date().toISOString().split('T')[0]}.pdf`
      
      doc.save(nombreArchivo)

    } catch (err) {
      console.error('Error generando PDF:', err)
    } finally {
      setGenerandoPDF(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando productos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-32 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cotización</h1>
          <p className="text-gray-500 text-sm">Genera cotizaciones sin afectar inventario</p>
        </div>
      </div>

      {/* Buscador */}
      <div className="mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl"
          />
        </div>
      </div>

      {/* Categorías */}
      <div className="mb-4 overflow-x-auto">
        <div className="flex gap-2 pb-2">
          <button
            onClick={() => setCategoriaSeleccionada('')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              !categoriaSeleccionada ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            Todos
          </button>
          {categorias.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategoriaSeleccionada(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                categoriaSeleccionada === cat.id ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {cat.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de productos */}
      {productosFiltrados.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="text-gray-500">No se encontraron productos</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {productosFiltrados.map(producto => {
            const enCarrito = items.find(i => i.producto_id === producto.id)
            return (
              <div
                key={producto.id}
                onClick={() => agregarProducto(producto)}
                className={`bg-white rounded-xl border p-3 cursor-pointer transition-all hover:shadow-md ${
                  enCarrito ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-gray-100'
                }`}
              >
                {producto.imagen_url ? (
                  <img
                    src={producto.imagen_url}
                    alt={producto.nombre}
                    className="w-full h-20 object-cover rounded-lg mb-2"
                  />
                ) : (
                  <div className="w-full h-20 bg-gray-100 rounded-lg mb-2 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                )}
                <p className="font-medium text-gray-900 text-sm line-clamp-2 mb-1">{producto.nombre}</p>
                <p className="text-emerald-600 font-bold">{formatCurrency(producto.precio_venta)}</p>
                {enCarrito && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                    {enCarrito.cantidad} en cotización
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Carrito flotante */}
      {items.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 px-4">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={() => setShowCarrito(true)}
              className="w-full bg-emerald-500 text-white rounded-2xl p-4 shadow-lg flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="font-bold">{items.length}</span>
                </div>
                <span className="font-medium">Ver cotización</span>
              </div>
              <span className="font-bold text-lg">{formatCurrency(totalCotizacion)}</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal Carrito/Cotización */}
      {showCarrito && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Cotización</h2>
                <button onClick={() => setShowCarrito(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Datos opcionales */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del cliente (opcional)</label>
                  <input
                    type="text"
                    value={clienteNombre}
                    onChange={e => setClienteNombre(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Válido por</label>
                    <select
                      value={validezDias}
                      onChange={e => setValidezDias(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-white"
                    >
                      <option value="3">3 días</option>
                      <option value="7">7 días</option>
                      <option value="15">15 días</option>
                      <option value="30">30 días</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Lista de items */}
              <div className="space-y-2">
                <h3 className="font-medium text-gray-900">Productos ({items.length})</h3>
                {items.map(item => (
                  <div key={item.producto_id} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-medium text-gray-900 flex-1 pr-2">{item.nombre}</p>
                      <button
                        onClick={() => eliminarItem(item.producto_id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center border border-gray-200 rounded-lg bg-white">
                        <button
                          onClick={() => actualizarCantidad(item.producto_id, item.cantidad - 1)}
                          className="px-3 py-1 text-gray-500 hover:text-gray-700"
                        >
                          -
                        </button>
                        <span className="px-3 py-1 font-medium">{item.cantidad}</span>
                        <button
                          onClick={() => actualizarCantidad(item.producto_id, item.cantidad + 1)}
                          className="px-3 py-1 text-gray-500 hover:text-gray-700"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-gray-400">×</span>
                      <input
                        type="number"
                        value={item.precio_unitario}
                        onChange={e => actualizarPrecio(item.producto_id, parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-center"
                        step="0.01"
                      />
                      <span className="text-gray-400">=</span>
                      <span className="font-bold text-emerald-600">{formatCurrency(item.subtotal)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  placeholder="Observaciones para el cliente..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl resize-none"
                  rows={2}
                />
              </div>

              {/* Total */}
              <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                <span className="text-lg font-medium text-gray-700">Total</span>
                <span className="text-2xl font-bold text-emerald-600">{formatCurrency(totalCotizacion)}</span>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 space-y-3">
              <button
                onClick={generarPDF}
                disabled={generandoPDF || items.length === 0}
                className="w-full py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generandoPDF ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Generando...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Descargar PDF
                  </>
                )}
              </button>
              <button
                onClick={limpiarCarrito}
                className="w-full py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50"
              >
                Limpiar cotización
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}