// Path: app\dashboard\productos\page.tsx
'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { ProductoWithCategoria, Categoria, ProductoFilters, StockStatus } from '@/types/database'
import { getStockStatus, getStockColor, getStockStatusText, formatearUnidad } from '@/lib/utils/productos'
import { formatCurrency } from '@/lib/utils/format'

export default function ProductosPage() {
  const [allProductos, setAllProductos] = useState<ProductoWithCategoria[]>([]) // Todos los productos
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState<ProductoFilters>({
    stock_status: undefined,
    categoria_id: undefined,
    activo: true
  })
  
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  // Fetch inicial de datos (solo una vez)
  useEffect(() => {
    if (usuario?.sucursal_id && usuario?.empresa_id) {
      fetchCategorias()
      fetchAllProductos()
    }
  }, [usuario?.sucursal_id, usuario?.empresa_id])

  const fetchCategorias = async () => {
    try {
      console.log('?? Fetching categorias para empresa:', usuario?.empresa_id)
      
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('empresa_id', usuario?.empresa_id)
        .eq('activa', true)
        .order('orden')

      if (error) throw error
      
      console.log('? Categorias obtenidas:', data)
      setCategorias(data || [])
    } catch (error) {
      console.error('? Error fetching categorias:', error)
    }
  }

  const fetchAllProductos = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('productos')
        .select(`
          *,
          categoria:categorias(*)
        `)
        .eq('sucursal_id', usuario?.sucursal_id)
        .order('nombre')

      if (error) throw error

      setAllProductos(data || [])
    } catch (error) {
      console.error('Error fetching productos:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filtrar productos en el cliente (sin refrescar)
  const productos = useMemo(() => {
    let filtered = [...allProductos]

    // Filtro por búsqueda
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim()
      filtered = filtered.filter(producto => 
        producto.nombre.toLowerCase().includes(search) ||
        producto.codigo?.toLowerCase().includes(search) ||
        producto.codigo_barras?.toLowerCase().includes(search)
      )
    }

    // Filtro por categoría
    if (filters.categoria_id) {
      filtered = filtered.filter(producto => producto.categoria_id === filters.categoria_id)
    }
    filtered = filtered.sort((a, b) => a.nombre.localeCompare(b.nombre))


    // Filtro por estado de stock
    if (filters.stock_status) {
      filtered = filtered.filter(producto => {
        const status = getStockStatus(producto)
        return status === filters.stock_status
      })
    }

    return filtered
  }, [allProductos, searchTerm, filters])

  // Contadores calculados
  const stockCounts = useMemo(() => {
    const total = productos.length
    const sin_stock = productos.filter(p => p.stock_actual === 0).length
    const stock_bajo = productos.filter(p => p.stock_actual > 0 && p.stock_actual <= p.stock_minimo).length

    return { total, sin_stock, stock_bajo }
  }, [productos])

  const toggleProductoStatus = useCallback(async (producto: ProductoWithCategoria) => {
    try {
      const { error } = await supabase
        .from('productos')
        .update({ activo: !producto.activo })
        .eq('id', producto.id)

      if (error) throw error
      
      // Actualizar en el estado local
      setAllProductos(prev => 
        prev.map(p => 
          p.id === producto.id 
            ? { ...p, activo: !p.activo }
            : p
        )
      )
    } catch (error) {
      console.error('Error updating producto status:', error)
    }
  }, [supabase])

  const ProductoCard = ({ producto }: { producto: ProductoWithCategoria }) => {
    const stockStatus = getStockStatus(producto)
    const stockColor = getStockColor(stockStatus)
    const stockText = getStockStatusText(stockStatus)
    
    return (
      <div 
        onClick={() => router.push(`/dashboard/productos/${producto.id}`)}
        className={`relative bg-white rounded-xl p-4 shadow-sm border transition-shadow cursor-pointer ${
          producto.activo 
            ? 'border-gray-200 hover:shadow-md hover:border-primary-300' 
            : 'border-orange-300 bg-orange-50 opacity-75'
        }`}
      >
        {/* Badge de inactivo */}
        {!producto.activo && (
          <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full z-10">
            Inactivo
          </div>
        )}
        
        {/* Imagen */}
        <div className="aspect-square mb-3 bg-gray-100 rounded-lg overflow-hidden relative">
          {producto.imagen_url ? (
            <img
              src={producto.imagen_url}
              alt={producto.nombre}
              className={`w-full h-full object-cover ${!producto.activo ? 'grayscale' : ''}`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Información */}
        <div>
          {/* Nombre */}
          <h3 className="font-semibold text-gray-900 mb-1 text-sm">
            {producto.nombre}
          </h3>

          

          {/* Categoría */}
          {producto.categoria && (
            <span 
              className="inline-block px-2 py-0.5 text-xs rounded-full text-white mb-2"
              style={{ backgroundColor: producto.categoria.color }}
            >
              {producto.categoria.nombre}
            </span>
          )}

          {/* Stock */}
          <div className="flex items-center mb-2">
            <div className={`w-2 h-2 rounded-full mr-1 ${stockColor}`}></div>
            <span className="text-xs font-medium text-gray-900">
              {producto.stock_actual} {formatearUnidad(producto.unidad, producto.stock_actual)}
            </span>
          </div>

          {/* Precio y Toggle */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-primary-600">
              {formatCurrency(producto.precio_venta)}
            </p>
            
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleProductoStatus(producto)
              }}
              className={`p-1.5 rounded-lg transition-colors ${
                producto.activo 
                  ? 'text-orange-600 hover:bg-orange-50' 
                  : 'text-green-600 hover:bg-green-50'
              }`}
              title={producto.activo ? 'Desactivar' : 'Activar'}
            >
              {producto.activo ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-square bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-gray-600">Gestiona el inventario de tu sucursal</p>
        </div>
        
        <div className="flex items-center justify-center sm:justify-end space-x-2">
          <button
            onClick={() => {
              if (allProductos.length > 0) {
                import('@/lib/utils/excel-productos').then(module => {
                  module.exportarInventario(allProductos)
                })
              } else {
                alert('No hay productos para exportar')
              }
            }}
            className="px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            Exportar
          </button>

          <button
            onClick={() => router.push('/dashboard/productos/importar')}
            className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Importar
          </button>

          <button
            onClick={() => router.push('/dashboard/productos/nuevo')}
            className="btn-primary"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Nuevo
          </button>
        </div>
      </div>

      {/* Buscador */}
      <div className="mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-3 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10 transition-all duration-200"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-6">
        {/* Filtros de stock con badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setFilters({ ...filters, stock_status: undefined })}
            className={`px-3 py-2 text-xs rounded-lg flex items-center transition-all duration-200 ${
              !filters.stock_status 
                ? 'bg-primary-100 text-primary-700 border border-primary-200' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todos
            <span className="ml-1 bg-white px-1.5 py-0.5 rounded-full text-xs">
              {stockCounts.total}
            </span>
          </button>
          
          <button
            onClick={() => setFilters({ ...filters, stock_status: StockStatus.SIN_STOCK })}
            className={`px-3 py-2 text-sm rounded-lg flex items-center transition-all duration-200 ${
              filters.stock_status === StockStatus.SIN_STOCK
                ? 'bg-red-100 text-red-700 border border-red-200' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Sin Stock
            <span className="ml-1 bg-white px-1.5 py-0.5 rounded-full text-xs">
              {stockCounts.sin_stock}
            </span>
          </button>

          <button
            onClick={() => setFilters({ ...filters, stock_status: StockStatus.STOCK_BAJO })}
            className={`px-3 py-2 text-sm rounded-lg flex items-center transition-all duration-200 ${
              filters.stock_status === StockStatus.STOCK_BAJO
                ? 'bg-orange-100 text-orange-700 border border-orange-200' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Stock Bajo
            <span className="ml-1 bg-white px-1.5 py-0.5 rounded-full text-xs">
              {stockCounts.stock_bajo}
            </span>
          </button>
        </div>

        {/* Dropdown de categorías */}
        <div className="relative">
          <select
            value={filters.categoria_id || ''}
            onChange={(e) => setFilters({ ...filters, categoria_id: e.target.value || undefined })}
            className="input transition-all duration-200"
          >
            <option value="">Todas las categorías</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid de productos */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {productos.map((producto) => (
          <ProductoCard key={producto.id} producto={producto} />
        ))}
      </div>

      {productos.length === 0 && !loading && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay productos</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || filters.categoria_id || filters.stock_status
              ? 'No se encontraron productos con los filtros aplicados'
              : 'Comienza agregando tu primer producto'
            }
          </p>
          {!searchTerm && !filters.categoria_id && !filters.stock_status && (
            <button
              onClick={() => router.push('/dashboard/productos/nuevo')}
              className="btn-primary mt-4"
            >
              Agregar Producto
            </button>
          )}
        </div>
      )}

      
    </div>
  )
}