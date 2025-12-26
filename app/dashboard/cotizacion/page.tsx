// Path: app\dashboard\cotizacion\page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { formatCurrency } from '@/lib/utils/format'
import jsPDF from 'jspdf'

interface Producto {
  id: string
  nombre: string
  codigo: string | null
  precio_venta: number
  stock_actual: number
  categoria_id: string | null
}

interface Categoria {
  id: string
  nombre: string
}

interface ItemCotizacion {
  producto_id: string
  nombre: string
  cantidad: number
  precio_unitario: number
  precio_original: number // AGREGADO para saber el precio original
  subtotal: number
}

interface DatosNegocio {
  empresa_nombre: string
  sucursal_nombre: string
  direccion: string | null
  telefono: string | null
  email: string | null
  logo_url: string | null
}

export default function CotizacionPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [datosNegocio, setDatosNegocio] = useState<DatosNegocio | null>(null)
  const [loading, setLoading] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [showExito, setShowExito] = useState(false)

  const [items, setItems] = useState<ItemCotizacion[]>([])
  const [cliente, setCliente] = useState('')
  const [notas, setNotas] = useState('')
  const [diasValidos, setDiasValidos] = useState(7)
  const [busqueda, setBusqueda] = useState('')
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('')

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
      // Datos del negocio
      const { data: empresaData } = await supabase
        .from('empresas')
        .select('nombre, logo_url, telefono, email, direccion')
        .eq('id', usuario.empresa_id)
        .single()

      const { data: sucursalData } = await supabase
        .from('sucursales')
        .select('nombre, direccion, telefono, logo_url')
        .eq('id', usuario.sucursal_id)
        .single()

      setDatosNegocio({
        empresa_nombre: empresaData?.nombre || 'Mi Negocio',
        sucursal_nombre: sucursalData?.nombre || '',
        direccion: sucursalData?.direccion || empresaData?.direccion || null,
        telefono: sucursalData?.telefono || empresaData?.telefono || null,
        email: empresaData?.email || null,
        logo_url: sucursalData?.logo_url || empresaData?.logo_url || null
      })

      // Productos
      const { data: prodsData } = await supabase
        .from('productos')
        .select('id, nombre, codigo, precio_venta, stock_actual, categoria_id')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('activo', true)
        .order('nombre')

      setProductos(prodsData || [])

      // Categorías
      const { data: categoriasData } = await supabase
        .from('categorias')
        .select('id, nombre')
        .eq('empresa_id', usuario.empresa_id)
        .eq('activa', true)
        .order('nombre')

      setCategorias(categoriasData || [])

    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

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

  const totalCotizacion = items.reduce((sum, item) => sum + item.subtotal, 0)

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
        precio_original: producto.precio_venta, // GUARDAR PRECIO ORIGINAL
        subtotal: producto.precio_venta
      }])
    }
  }

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

  const actualizarPrecio = (productoId: string, nuevoPrecio: number) => {
    if (nuevoPrecio < 0) return
    setItems(prev => prev.map(i =>
      i.producto_id === productoId
        ? { ...i, precio_unitario: nuevoPrecio, subtotal: i.cantidad * nuevoPrecio }
        : i
    ))
  }

  const eliminarItem = (productoId: string) => {
    setItems(prev => prev.filter(i => i.producto_id !== productoId))
  }

  const limpiarCotizacion = () => {
    setItems([])
    setCliente('')
    setNotas('')
  }

  const getImageBase64 = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(blob)
      })
    } catch {
      return null
    }
  }

  const generarPDF = async () => {
    if (items.length === 0) return

    setGenerando(true)

    try {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      let y = 20

      // Logo (si existe)
      if (datosNegocio?.logo_url) {
        try {
          const logoBase64 = await getImageBase64(datosNegocio.logo_url)
          if (logoBase64) {
            doc.addImage(logoBase64, 'JPEG', 15, y, 35, 25)
            y += 5
          }
        } catch (e) {
          console.log('No se pudo cargar el logo')
        }
      }

      // Encabezado del negocio
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(16, 185, 129) // emerald-500
      doc.text(datosNegocio?.empresa_nombre || 'Mi Negocio', pageWidth / 2, y, { align: 'center' })
      y += 8

      if (datosNegocio?.sucursal_nombre) {
        doc.setFontSize(12)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(75, 85, 99)
        doc.text(datosNegocio.sucursal_nombre, pageWidth / 2, y, { align: 'center' })
        y += 6
      }

      if (datosNegocio?.direccion) {
        doc.setFontSize(10)
        doc.text(datosNegocio.direccion, pageWidth / 2, y, { align: 'center' })
        y += 5
      }

      if (datosNegocio?.telefono || datosNegocio?.email) {
        const contacto = [datosNegocio.telefono, datosNegocio.email].filter(Boolean).join(' | ')
        doc.text(contacto, pageWidth / 2, y, { align: 'center' })
        y += 10
      }

      // Título "COTIZACIÓN"
      y += 5
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(31, 41, 55)
      doc.text('COTIZACIÓN', pageWidth / 2, y, { align: 'center' })
      y += 10

      // Info del cliente y fecha
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(75, 85, 99)
      
      const hoy = new Date().toLocaleDateString('es-BO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      
      const validaHasta = new Date()
      validaHasta.setDate(validaHasta.getDate() + diasValidos)
      const fechaValidez = validaHasta.toLocaleDateString('es-BO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })

      doc.text(`Fecha: ${hoy}`, 15, y)
      y += 5
      doc.text(`Válida hasta: ${fechaValidez}`, 15, y)
      y += 5
      
      if (cliente) {
        doc.text(`Cliente: ${cliente}`, 15, y)
        y += 5
      }

      y += 5

      // Tabla de productos
      doc.setFillColor(16, 185, 129)
      doc.rect(15, y, pageWidth - 30, 8, 'F')
      
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Producto', 17, y + 5.5)
      doc.text('Cant.', pageWidth - 75, y + 5.5)
      doc.text('Precio Unit.', pageWidth - 60, y + 5.5)
      doc.text('Subtotal', pageWidth - 30, y + 5.5, { align: 'right' })
      
      y += 10

      // Items
      doc.setTextColor(31, 41, 55)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)

      items.forEach((item) => {
        if (y > 270) {
          doc.addPage()
          y = 20
        }

        const nombreMaxWidth = pageWidth - 95
        const lineasNombre = doc.splitTextToSize(item.nombre, nombreMaxWidth)
        
        doc.text(lineasNombre, 17, y + 4)
        doc.text(item.cantidad.toString(), pageWidth - 75, y + 4)
        doc.text(formatCurrency(item.precio_unitario), pageWidth - 60, y + 4)
        doc.text(formatCurrency(item.subtotal), pageWidth - 30, y + 4, { align: 'right' })
        
        y += 8 + (lineasNombre.length - 1) * 4
      })

      // Línea divisoria
      y += 3
      doc.setDrawColor(229, 231, 235)
      doc.line(15, y, pageWidth - 15, y)
      y += 8

      // Total
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text('TOTAL:', pageWidth - 60, y)
      doc.setTextColor(16, 185, 129)
      doc.text(formatCurrency(totalCotizacion), pageWidth - 30, y, { align: 'right' })
      y += 10

      // Notas
      if (notas) {
        y += 5
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(75, 85, 99)
        doc.text('Notas:', 15, y)
        y += 5
        doc.setFont('helvetica', 'normal')
        const lineasNotas = doc.splitTextToSize(notas, pageWidth - 30)
        doc.text(lineasNotas, 15, y)
      }

      // Descargar
      const fecha = new Date().toISOString().split('T')[0]
      const nombreCliente = cliente ? `-${cliente.replace(/\s+/g, '-')}` : ''
      doc.save(`cotizacion${nombreCliente}-${fecha}.pdf`)

      setShowExito(true)
      setTimeout(() => setShowExito(false), 2000)

    } catch (err) {
      console.error('Error generando PDF:', err)
      alert('Error al generar el PDF')
    } finally {
      setGenerando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">📋 Cotización</h1>
              <p className="text-sm text-gray-600">Genera PDF para compartir con clientes</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto">
        {/* Mensaje de éxito */}
        {showExito && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full animate-bounce-in">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">¡PDF Generado!</h2>
              <p className="text-gray-500 mt-2">La cotización se ha descargado</p>
            </div>
          </div>
        )}

        {/* Datos del negocio */}
        {datosNegocio && (
          <div className="bg-emerald-50 rounded-xl p-4 mb-4 flex items-center gap-4">
            {datosNegocio.logo_url && (
              <img 
                src={datosNegocio.logo_url} 
                alt="Logo" 
                className="w-12 h-12 rounded-lg object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <div>
              <h2 className="font-bold text-emerald-800">{datosNegocio.empresa_nombre}</h2>
              {datosNegocio.sucursal_nombre && (
                <p className="text-sm text-emerald-600">{datosNegocio.sucursal_nombre}</p>
              )}
              {datosNegocio.telefono && (
                <p className="text-xs text-emerald-700">Tel: {datosNegocio.telefono}</p>
              )}
            </div>
          </div>
        )}

        {/* Cliente y opciones */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente (opcional)</label>
            <input
              type="text"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="Nombre del cliente"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Válida por</label>
            <select
              value={diasValidos}
              onChange={(e) => setDiasValidos(parseInt(e.target.value))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value={3}>3 días</option>
              <option value={7}>7 días</option>
              <option value={15}>15 días</option>
              <option value={30}>30 días</option>
            </select>
          </div>
        </div>

        {/* Búsqueda */}
        <div className="mb-4">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            placeholder="🔍 Buscar producto..."
          />
        </div>

        {/* Categorías */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
          <button
            onClick={() => setCategoriaSeleccionada('')}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
              !categoriaSeleccionada ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Todos
          </button>
          {categorias.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoriaSeleccionada(cat.id)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
                categoriaSeleccionada === cat.id ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {cat.nombre}
            </button>
          ))}
        </div>

        {/* Grid de productos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          {productosFiltrados.slice(0, 12).map((producto) => (
            <button
              key={producto.id}
              onClick={() => agregarProducto(producto)}
              className="bg-white rounded-xl border border-gray-100 p-3 text-left hover:shadow-md transition-shadow"
            >
              <p className="font-medium text-gray-900 text-sm truncate">{producto.nombre}</p>
              <p className="text-emerald-600 font-bold text-sm">{formatCurrency(producto.precio_venta)}</p>
              {producto.codigo && (
                <p className="text-xs text-gray-400">{producto.codigo}</p>
              )}
            </button>
          ))}
        </div>

        {/* Items de la cotización - MEJORADO */}
        {items.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Productos seleccionados</h3>
              <button
                onClick={limpiarCotizacion}
                className="text-sm text-red-500 hover:text-red-700 font-medium"
              >
                Limpiar todo
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.producto_id} className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  {/* Nombre del producto */}
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-medium text-gray-900 text-sm flex-1">{item.nombre}</p>
                    <button
                      onClick={() => eliminarItem(item.producto_id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Controles: Cantidad y Precio */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Cantidad */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => actualizarCantidad(item.producto_id, item.cantidad - 1)}
                          className="w-8 h-8 bg-white border border-gray-300 rounded-lg flex items-center justify-center text-gray-700 hover:bg-gray-100"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={item.cantidad}
                          onChange={(e) => actualizarCantidad(item.producto_id, parseInt(e.target.value) || 0)}
                          className="w-14 text-center border border-gray-300 rounded-lg py-1.5 text-sm font-medium"
                          min="1"
                        />
                        <button
                          onClick={() => actualizarCantidad(item.producto_id, item.cantidad + 1)}
                          className="w-8 h-8 bg-white border border-gray-300 rounded-lg flex items-center justify-center text-gray-700 hover:bg-gray-100"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Precio Unitario - EDITABLE */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Precio Unit.
                        {item.precio_unitario !== item.precio_original && (
                          <span className="ml-1 text-amber-600">✏️ Editado</span>
                        )}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">Bs.</span>
                        <input
                          type="number"
                          value={item.precio_unitario}
                          onChange={(e) => actualizarPrecio(item.producto_id, parseFloat(e.target.value) || 0)}
                          className="w-full pl-10 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      {item.precio_unitario !== item.precio_original && (
                        <p className="text-xs text-gray-400 mt-1">
                          Original: {formatCurrency(item.precio_original)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Subtotal */}
                  <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-sm text-gray-600">Subtotal:</span>
                    <span className="text-lg font-bold text-emerald-600">
                      {formatCurrency(item.subtotal)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notas */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas adicionales (opcional)</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
            rows={3}
            placeholder="Condiciones de pago, observaciones, etc..."
          />
        </div>

        {/* Info */}
        {items.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="font-medium">Selecciona productos para empezar</p>
            <p className="text-sm mt-1">Puedes editar cantidades y precios antes de generar el PDF</p>
          </div>
        )}
      </div>

      {/* Barra fija inferior */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">{items.length} producto(s)</p>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalCotizacion)}</p>
          </div>
          <button
            onClick={generarPDF}
            disabled={items.length === 0 || generando}
            className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {generando ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Generando...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Generar PDF
              </>
            )}
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