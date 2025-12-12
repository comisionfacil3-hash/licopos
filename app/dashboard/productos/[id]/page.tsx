'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { ProductoWithCategoria, Categoria, CreateProductoForm } from '@/types/database'
import { calcularMargen } from '@/lib/utils/productos'
import { formatCurrency } from '@/lib/utils/format'

export default function EditarProductoPage() {
  const [formData, setFormData] = useState<CreateProductoForm>({
    categoria_id: '',
    codigo: '',
    codigo_barras: '',
    nombre: '',
    descripcion: '',
    marca: '',
    unidad: 'unidad',
    precio_compra: 0,
    precio_venta: 0,
    stock_actual: 0,
    stock_minimo: 5,
    stock_maximo: 100,
    activo: true
  })
  
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imagen, setImagen] = useState<File | null>(null)
  const [imagenActual, setImagenActual] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [producto, setProducto] = useState<ProductoWithCategoria | null>(null)
  
  const { usuario } = useAuth()
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  const unidades = [
    { value: 'unidad', label: 'Unidad' },
    { value: 'caja', label: 'Caja' },
    { value: 'botella', label: 'Botella' },
    { value: 'lata', label: 'Lata' },
    { value: 'paquete', label: 'Paquete' },
    { value: 'kg', label: 'Kilogramo' },
    { value: 'gramos', label: 'Gramos' },
    { value: 'litros', label: 'Litros' },
    { value: 'ml', label: 'Mililitros' }
  ]

  useEffect(() => {
    if (params.id) {
      fetchProducto()
      fetchCategorias()
    }
  }, [params.id])

  const fetchProducto = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('productos')
        .select(`
          *,
          categoria:categorias(*)
        `)
        .eq('id', params.id)
        .eq('sucursal_id', usuario?.sucursal_id)
        .single()

      if (error) throw error

      setProducto(data)
      setImagenActual(data.imagen_url)
      
      // Llenar formulario
      setFormData({
        categoria_id: data.categoria_id || '',
        codigo: data.codigo || '',
        codigo_barras: data.codigo_barras || '',
        nombre: data.nombre,
        descripcion: data.descripcion || '',
        marca: data.marca || '',
        unidad: data.unidad,
        precio_compra: data.precio_compra,
        precio_venta: data.precio_venta,
        stock_actual: data.stock_actual,
        stock_minimo: data.stock_minimo,
        stock_maximo: data.stock_maximo,
        activo: data.activo
      })

    } catch (error) {
      console.error('Error fetching producto:', error)
      router.push('/dashboard/productos')
    } finally {
      setLoading(false)
    }
  }

  const fetchCategorias = async () => {
    try {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('empresa_id', usuario?.empresa_id)
        .eq('activa', true)
        .order('orden')

      if (error) throw error
      setCategorias(data || [])
    } catch (error) {
      console.error('Error fetching categorias:', error)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImagen(file)
      
      // Crear preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadImagen = async (): Promise<string | null> => {
    if (!imagen || !usuario?.sucursal_id) return null

    try {
      setUploading(true)
      
      const fileExt = imagen.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random()}.${fileExt}`
      const filePath = `${usuario.sucursal_id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, imagen)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('Error uploading image:', error)
      return null
    } finally {
      setUploading(false)
    }
  }

  const eliminarProducto = async () => {
    if (!confirm('¿Estás seguro de que deseas eliminar este producto?')) return

    try {
      setSaving(true)

      const { error } = await supabase
        .from('productos')
        .delete()
        .eq('id', params.id)

      if (error) throw error

      router.push('/dashboard/productos')
    } catch (error) {
      console.error('Error deleting producto:', error)
      alert('Error al eliminar el producto')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      // Validaciones
      if (!formData.nombre.trim()) {
        alert('El nombre del producto es obligatorio')
        return
      }

      if (formData.precio_compra < 0 || formData.precio_venta < 0) {
        alert('Los precios no pueden ser negativos')
        return
      }

      if (formData.precio_venta <= formData.precio_compra) {
        alert('El precio de venta debe ser mayor al precio de compra')
        return
      }

      // Subir nueva imagen si existe
      let imagenUrl = imagenActual
      if (imagen) {
        const newImageUrl = await uploadImagen()
        if (newImageUrl) {
          imagenUrl = newImageUrl
        }
      }

      // Actualizar producto
      const { error } = await supabase
        .from('productos')
        .update({
          categoria_id: formData.categoria_id || null,
          codigo: formData.codigo,
          codigo_barras: formData.codigo_barras || null,
          nombre: formData.nombre.trim(),
          descripcion: formData.descripcion?.trim() || null,
          marca: formData.marca?.trim() || null,
          unidad: formData.unidad,
          precio_compra: formData.precio_compra,
          precio_venta: formData.precio_venta,
          stock_actual: formData.stock_actual,
          stock_minimo: formData.stock_minimo,
          stock_maximo: formData.stock_maximo,
          imagen_url: imagenUrl,
          activo: formData.activo
        })
        .eq('id', params.id)

      if (error) throw error

      router.push('/dashboard/productos')
    } catch (error) {
      console.error('Error updating producto:', error)
      alert('Error al actualizar el producto')
    } finally {
      setSaving(false)
    }
  }

  const margen = calcularMargen(formData.precio_compra, formData.precio_venta)

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-64 bg-gray-200 rounded-xl"></div>
          <div className="h-32 bg-gray-200 rounded-xl"></div>
          <div className="h-32 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    )
  }

  if (!producto) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900">Producto no encontrado</h3>
          <button onClick={() => router.push('/dashboard/productos')} className="btn-primary mt-4">
            Volver a Productos
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg mr-3"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Editar Producto</h1>
            <p className="text-gray-600">{producto.nombre}</p>
          </div>
        </div>

        <button
          onClick={eliminarProducto}
          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
          disabled={saving}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Imagen */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Imagen del Producto</h3>
          
          <div className="flex flex-col items-center">
            {previewUrl || imagenActual ? (
              <div className="relative">
                <img
                  src={previewUrl || imagenActual || ''}
                  alt="Producto"
                  className="w-32 h-32 object-cover rounded-xl border"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImagen(null)
                    setPreviewUrl(null)
                    if (!previewUrl) setImagenActual(null)
                  }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-sm"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            
            <label className="mt-4 cursor-pointer">
              <span className="btn-secondary">
                {uploading ? 'Subiendo...' : 'Cambiar Imagen'}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>
        </div>

        {/* Información básica */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Información Básica</h3>
          
          <div className="space-y-4">
            <div>
              <label className="label">Nombre del Producto *</label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className="input"
                placeholder="Ej: Cerveza Paceña 620ml"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Código</label>
                <input
                  type="text"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  className="input"
                  placeholder="Código del producto"
                />
              </div>

              <div>
                <label className="label">Código de Barras</label>
                <input
                  type="text"
                  value={formData.codigo_barras}
                  onChange={(e) => setFormData({ ...formData, codigo_barras: e.target.value })}
                  className="input"
                  placeholder="123456789012"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Marca</label>
                <input
                  type="text"
                  value={formData.marca}
                  onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                  className="input"
                  placeholder="Ej: Paceña"
                />
              </div>

              <div>
                <label className="label">Categoría</label>
                <select
                  value={formData.categoria_id}
                  onChange={(e) => setFormData({ ...formData, categoria_id: e.target.value })}
                  className="input"
                >
                  <option value="">Seleccionar categoría</option>
                  {categorias.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Descripción</label>
              <textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                className="input"
                rows={3}
                placeholder="Descripción del producto..."
              />
            </div>
          </div>
        </div>

        {/* Precios */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Precios y Margen</h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Precio de Compra *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.precio_compra}
                  onChange={(e) => setFormData({ ...formData, precio_compra: parseFloat(e.target.value) || 0 })}
                  className="input"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="label">Precio de Venta *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.precio_venta}
                  onChange={(e) => setFormData({ ...formData, precio_venta: parseFloat(e.target.value) || 0 })}
                  className="input"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            {/* Margen de ganancia */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Margen de Ganancia:</span>
                <span className={`text-lg font-bold ${margen > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {margen.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm text-gray-500">Ganancia por unidad:</span>
                <span className="text-sm font-medium">
                  {formatCurrency(formData.precio_venta - formData.precio_compra)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Inventario */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Inventario</h3>
          
          <div className="space-y-4">
            <div>
              <label className="label">Unidad de Medida</label>
              <select
                value={formData.unidad}
                onChange={(e) => setFormData({ ...formData, unidad: e.target.value })}
                className="input"
              >
                {unidades.map((unidad) => (
                  <option key={unidad.value} value={unidad.value}>
                    {unidad.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">Stock Actual</label>
                <input
                  type="number"
                  value={formData.stock_actual}
                  onChange={(e) => setFormData({ ...formData, stock_actual: parseInt(e.target.value) || 0 })}
                  className="input"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1">Stock original: {producto.stock_actual}</p>
              </div>

              <div>
                <label className="label">Stock Mínimo</label>
                <input
                  type="number"
                  value={formData.stock_minimo}
                  onChange={(e) => setFormData({ ...formData, stock_minimo: parseInt(e.target.value) || 0 })}
                  className="input"
                  placeholder="5"
                />
              </div>

              <div>
                <label className="label">Stock Máximo</label>
                <input
                  type="number"
                  value={formData.stock_maximo}
                  onChange={(e) => setFormData({ ...formData, stock_maximo: parseInt(e.target.value) || 0 })}
                  className="input"
                  placeholder="100"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Estado */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Estado del Producto</h3>
              <p className="text-sm text-gray-500">El producto estará disponible para la venta</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.activo}
                onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
        </div>

        {/* Botones */}
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary flex-1"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary flex-1"
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="spinner mr-2"></span>
                Guardando...
              </>
            ) : (
              'Actualizar Producto'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}