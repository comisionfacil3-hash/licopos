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
      doc.text(datosNegocio?.empresa_nombre || 'Mi Negocio', datosNegocio?.logo_url ? 55 : 15, y)
      y += 7

      if (datosNegocio?.sucursal_nombre) {
        doc.setFontSize(12)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100, 100, 100)
        doc.text(datosNegocio.sucursal_nombre, datosNegocio?.logo_url ? 55 : 15, y)
        y += 5
      }

      if (datosNegocio?.direccion) {
        doc.setFontSize(10)
        doc.text(datosNegocio.direccion, datosNegocio?.logo_url ? 55 : 15, y)
        y += 4
      }

      if (datosNegocio?.telefono) {
        doc.text(`Tel: ${datosNegocio.telefono}`, datosNegocio?.logo_url ? 55 : 15, y)
        y += 4
      }

      if (datosNegocio?.email) {
        doc.text(datosNegocio.email, datosNegocio?.logo_url ? 55 : 15, y)
        y += 4
      }

      y = Math.max(y, 50) + 10

      // Línea separadora
      doc.setDrawColor(200, 200, 200)
      doc.line(15, y, pageWidth - 15, y)
      y += 10

      // Título COTIZACIÓN
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 0, 0)
      doc.text('COTIZACIÓN', pageWidth / 2, y, { align: 'center' })
      y += 12

      // Fecha y validez
      const fechaActual = new Date().toLocaleDateString('es-BO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      const fechaVencimiento = new Date()
      fechaVencimiento.setDate(fechaVencimiento.getDate() + diasValidos)
      const fechaVenc = fechaVencimiento.toLocaleDateString('es-BO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 100, 100)
      doc.text(`Fecha: ${fechaActual}`, 15, y)
      doc.text(`Válida hasta: ${fechaVenc}`, pageWidth - 15, y, { align: 'right' })
      y += 8

      // Cliente (si hay)
      if (cliente.trim()) {
        doc.setFontSize(11)
        doc.setTextColor(0, 0, 0)
        doc.text(`Cliente: ${cliente}`, 15, y)
        y += 8
      }

      y += 5

      // Tabla de productos
      doc.setFillColor(16, 185, 129) // emerald-500
      doc.rect(15, y, pageWidth - 30, 8, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('Producto', 18, y + 5.5)
      doc.text('Cant.', pageWidth - 75, y + 5.5, { align: 'center' })
      doc.text('P. Unit.', pageWidth - 50, y + 5.5, { align: 'right' })
      doc.text('Subtotal', pageWidth - 18, y + 5.5, { align: 'right' })
      y += 12

      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'normal')

      items.forEach((item, index) => {
        if (y > 260) {
          doc.addPage()
          y = 20
        }

        if (index % 2 === 0) {
          doc.setFillColor(249, 250, 251)
          doc.rect(15, y - 4, pageWidth - 30, 8, 'F')
        }

        const nombreTruncado = item.nombre.length > 35 
          ? item.nombre.substring(0, 35) + '...' 
          : item.nombre

        doc.text(nombreTruncado, 18, y)
        doc.text(item.cantidad.toString(), pageWidth - 75, y, { align: 'center' })
        doc.text(`Bs. ${item.precio_unitario.toFixed(2)}`, pageWidth - 50, y, { align: 'right' })
        doc.text(`Bs. ${item.subtotal.toFixed(2)}`, pageWidth - 18, y, { align: 'right' })
        y += 8
      })

      y += 5
      doc.line(15, y, pageWidth - 15, y)
      y += 10

      // Total
      doc.setFillColor(16, 185, 129)
      doc.rect(pageWidth - 80, y - 4, 65, 12, 'F')
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text(`TOTAL: Bs. ${totalCotizacion.toFixed(2)}`, pageWidth - 18, y + 3, { align: 'right' })
      y += 20

      // Notas
      if (notas.trim()) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(100, 100, 100)
        doc.text('Notas:', 15, y)
        y += 5
        doc.setFont('helvetica', 'normal')
        const notasLineas = doc.splitTextToSize(notas, pageWidth - 30)
        doc.text(notasLineas, 15, y)
        y += notasLineas.length * 5 + 5
      }

      // Pie de página
      y = doc.internal.pageSize.getHeight() - 20
      doc.setFontSize(9)
      doc.setTextColor(150, 150, 150)
      doc.text(`Cotización válida por ${diasValidos} días a partir de la fecha de emisión.`, pageWidth / 2, y, { align: 'center' })
      doc.text('Precios sujetos a cambio sin previo aviso.', pageWidth / 2, y + 4, { align: 'center' })

      // Guardar
      doc.save(`cotizacion_${new Date().toISOString().split('T')[0]}.pdf`)

      setShowExito(true)
      setTimeout(() => setShowExito(false), 2500)

    } catch (err) {
      console.error('Error generando PDF:', err)
      alert('Error al generar el PDF')
    } finally {
      setGenerando(false)
    }
  }

  const limpiarCotizacion = () => {
    setItems([])
    setCliente('')
    setNotas('')
  }

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

  return (
    <div className="p-4 pb-32 max-w-4xl mx-auto">
      {/* Modal Éxito */}
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

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cotización</h1>
        <p className="text-gray-500 text-sm">Genera un PDF para compartir con tu cliente</p>
      </div>

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

      {/* Búsqueda y categorías */}
      <div className="mb-4">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
          placeholder="Buscar producto..."
        />
      </div>

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
            <p className="text-emerald-600 font-bold">{formatCurrency(producto.precio_venta)}</p>
          </button>
        ))}
      </div>

      {/* Items de la cotización */}
      {items.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Productos seleccionados</h3>
            <button
              onClick={limpiarCotizacion}
              className="text-sm text-red-500 hover:text-red-700"
            >
              Limpiar
            </button>
          </div>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.producto_id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{item.nombre}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => actualizarCantidad(item.producto_id, item.cantidad - 1)}
                    className="w-7 h-7 bg-white border rounded flex items-center justify-center text-sm"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={item.cantidad}
                    onChange={(e) => actualizarCantidad(item.producto_id, parseInt(e.target.value) || 0)}
                    className="w-10 text-center border rounded py-1 text-sm"
                    min="1"
                  />
                  <button
                    onClick={() => actualizarCantidad(item.producto_id, item.cantidad + 1)}
                    className="w-7 h-7 bg-white border rounded flex items-center justify-center text-sm"
                  >
                    +
                  </button>
                </div>
                <span className="font-medium text-emerald-600 w-20 text-right text-sm">
                  {formatCurrency(item.subtotal)}
                </span>
                <button
                  onClick={() => eliminarItem(item.producto_id)}
                  className="p-1 text-red-500"
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
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
          rows={2}
          placeholder="Observaciones para el cliente..."
        />
      </div>

      {/* Barra fija inferior */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">{items.length} producto(s)</p>
            <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalCotizacion)}</p>
          </div>
          <button
            onClick={generarPDF}
            disabled={items.length === 0 || generando}
            className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2"
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
