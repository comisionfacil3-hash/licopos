'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { Categoria, CreateProductoForm } from '@/types/database'
import { calcularMargen } from '@/lib/utils/productos'
import { formatCurrency } from '@/lib/utils/format'

export default function NuevoProductoPage() {
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
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imagen, setImagen] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  
  const { usuario } = useAuth()
  const router = useRouter()
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
    fetchCategorias()
    generateCodigo()
  }, [])

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

  const generateCodigo = async () => {
    try {
      const { data } = await supabase.rpc('generar_codigo_producto', {
        p_sucursal_id: usuario?.sucursal_id
      })
      
      if (data) {
        setFormData(prev => ({ ...prev, codigo: data }))
      }
    } catch (error) {
      console.error('Error generating codigo:', error)
    }
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        // Importar y comprimir imagen
        const { compressImage } = await import('@/lib/utils/image-compressor')
        const compressedFile = await compressImage(file, {
          maxWidth: 800,
          maxHeight: 800,
          quality: 0.7
        })
        
        setImagen(compressedFile)
        
        // Crear preview
        const reader = new FileReader()
        reader.onloadend = () => {
          setPreviewUrl(reader.result as string)
        }
        reader.readAsDataURL(compressedFile)
      } catch (error) {
        console.error('Error al comprimir imagen:', error)
        // Si falla la compresión, usar la imagen original
        setImagen(file)
        const reader = new FileReader()
        reader.onloadend = () => {
          setPreviewUrl(reader.result as string)
        }
        reader.readAsDataURL(file)
      }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

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

      // Subir imagen si existe
      let imagenUrl = null
      if (imagen) {
        imagenUrl = await uploadImagen()
      }

      // Crear producto
      const { error } = await supabase
        .from('productos')
        .insert({
          sucursal_id: usuario?.sucursal_id,
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

      if (error) throw error

      router.push('/dashboard/productos')
    } catch (error) {
      console.error('Error creating producto:', error)
      alert('Error al crear el producto')
    } finally {
      setLoading(false)
    }
  }

  const margen = calcularMargen(formData.precio_compra, formData.precio_venta)

  return (
    <div className="p-4 pb-24">
      {/* Header */}
      <div className="flex items-center mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg mr-3"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nuevo Producto</h1>
          <p className="text-gray-600">Agrega un producto al inventario</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Imagen */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Imagen del Producto</h3>
          
          <div className="flex flex-col items-center">
            {previewUrl ? (
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-32 h-32 object-cover rounded-xl border"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImagen(null)
                    setPreviewUrl(null)
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
                {uploading ? 'Subiendo...' : 'Seleccionar Imagen'}
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
                  placeholder="Autogenerado"
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
                <label className="label">Stock Inicial</label>
                <input
                  type="number"
                  value={formData.stock_actual}
                  onChange={(e) => setFormData({ ...formData, stock_actual: parseInt(e.target.value) || 0 })}
                  className="input"
                  placeholder="0"
                />
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
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary flex-1"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner mr-2"></span>
                Guardando...
              </>
            ) : (
              'Guardar Producto'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}