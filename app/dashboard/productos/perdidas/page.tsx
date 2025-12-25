// Path: app\dashboard\productos\perdidas\page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { Producto, PerdidaWithDetails, CreatePerdidaForm } from '@/types/database'
import { formatCurrency } from '@/lib/utils/format'
import { formatDate } from '@/lib/utils/timezone'
import { formatearUnidad } from '@/lib/utils/productos'

export default function PerdidasPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [perdidas, setPerdidas] = useState<PerdidaWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  
  const [formData, setFormData] = useState<CreatePerdidaForm>({
    producto_id: '',
    cantidad: 1,
    motivo: ''
  })

  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (usuario?.sucursal_id) {
      fetchProductos()
      fetchPerdidas()
    }
  }, [usuario])

  const fetchProductos = async () => {
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .eq('sucursal_id', usuario?.sucursal_id)
        .eq('activo', true)
        .gt('stock_actual', 0)
        .order('nombre')

      if (error) throw error
      setProductos(data || [])
    } catch (error) {
      console.error('Error fetching productos:', error)
    }
  }

  const fetchPerdidas = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('perdidas')
        .select(`
          *,
          producto:productos(*),
          usuario:usuarios(nombre)
        `)
        .eq('sucursal_id', usuario?.sucursal_id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setPerdidas(data || [])
    } catch (error) {
      console.error('Error fetching perdidas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      // Validaciones
      if (!formData.producto_id) {
        alert('Selecciona un producto')
        return
      }

      if (formData.cantidad <= 0) {
        alert('La cantidad debe ser mayor a 0')
        return
      }

      if (!formData.motivo.trim()) {
        alert('El motivo es obligatorio')
        return
      }

      // Verificar que hay stock suficiente
      const producto = productos.find(p => p.id === formData.producto_id)
      if (!producto) {
        alert('Producto no encontrado')
        return
      }

      if (formData.cantidad > producto.stock_actual) {
        alert(`Stock insuficiente. Stock actual: ${producto.stock_actual}`)
        return
      }

      // Registrar pérdida
      const { error } = await supabase
        .from('perdidas')
        .insert({
          sucursal_id: usuario?.sucursal_id,
          producto_id: formData.producto_id,
          usuario_id: usuario?.id,
          cantidad: formData.cantidad,
          costo_unitario: producto.precio_compra,
          costo_total: producto.precio_compra * formData.cantidad,
          motivo: formData.motivo.trim()
        })

      if (error) throw error

      // Resetear formulario
      setFormData({
        producto_id: '',
        cantidad: 1,
        motivo: ''
      })
      setShowForm(false)

      // Refrescar datos
      fetchProductos()
      fetchPerdidas()

    } catch (error) {
      console.error('Error registering perdida:', error)
      alert('Error al registrar la pérdida')
    } finally {
      setSaving(false)
    }
  }

  const productosFiltrados = productos.filter(producto =>
    producto.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    producto.codigo?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const calcularTotalPerdidas = () => {
    return perdidas.reduce((total, perdida) => total + perdida.costo_total, 0)
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-32 bg-gray-200 rounded-xl"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
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
            <h1 className="text-xl font-bold text-gray-900">Pérdidas y Mermas</h1>
            <p className="text-gray-600">Registra productos dañados o perdidos</p>
          </div>
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="btn-primary"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Registrar
        </button>
      </div>

      {/* Estadísticas */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
        <h3 className="text-lg font-semibold mb-4">Resumen</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Total de Registros</p>
            <p className="text-2xl font-bold text-gray-900">{perdidas.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Costo Total</p>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(calcularTotalPerdidas())}
            </p>
          </div>
        </div>
      </div>

      {/* Lista de pérdidas */}
      <div className="space-y-4">
        {perdidas.map((perdida) => (
          <div key={perdida.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {perdida.producto?.nombre}
                  </h3>
                  <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                    Pérdida
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-gray-500">Cantidad</p>
                    <p className="text-sm font-medium">
                      {perdida.cantidad} {formatearUnidad(perdida.producto?.unidad || 'unidad', perdida.cantidad)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Costo</p>
                    <p className="text-sm font-bold text-red-600">
                      {formatCurrency(perdida.costo_total)}
                    </p>
                  </div>
                </div>

                <div className="mb-2">
                  <p className="text-xs text-gray-500">Motivo</p>
                  <p className="text-sm text-gray-900">{perdida.motivo}</p>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Por: {perdida.usuario?.nombre}</span>
                  <span>{formatDate(perdida.created_at)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {perdidas.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay pérdidas registradas</h3>
            <p className="mt-1 text-sm text-gray-500">
              Los productos dañados o perdidos aparecerán aquí
            </p>
          </div>
        )}
      </div>

      {/* Modal de formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
          <div className="bg-white rounded-t-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Registrar Pérdida</h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                  disabled={saving}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="label">Producto *</label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Buscar producto..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="input"
                    />
                    
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                      {productosFiltrados.map((producto) => (
                        <button
                          key={producto.id}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, producto_id: producto.id })
                            setSearchTerm(producto.nombre)
                          }}
                          className={`w-full p-3 text-left hover:bg-gray-50 border-b last:border-b-0 ${
                            formData.producto_id === producto.id ? 'bg-primary-50' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">{producto.nombre}</p>
                              <p className="text-sm text-gray-500">{producto.codigo}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">Stock: {producto.stock_actual}</p>
                              <p className="text-xs text-gray-500">{formatCurrency(producto.precio_compra)}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                      
                      {productosFiltrados.length === 0 && searchTerm && (
                        <div className="p-4 text-center text-gray-500">
                          No se encontraron productos
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="label">Cantidad *</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.cantidad}
                    onChange={(e) => setFormData({ ...formData, cantidad: parseInt(e.target.value) || 1 })}
                    className="input"
                    required
                  />
                  {formData.producto_id && (
                    <p className="text-xs text-gray-500 mt-1">
                      Stock disponible: {productos.find(p => p.id === formData.producto_id)?.stock_actual}
                    </p>
                  )}
                </div>

                <div>
                  <label className="label">Motivo *</label>
                  <textarea
                    value={formData.motivo}
                    onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                    className="input"
                    rows={3}
                    placeholder="Describe el motivo de la pérdida..."
                    required
                  />
                </div>

                {formData.producto_id && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Resumen</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Costo unitario:</span>
                        <span>{formatCurrency(productos.find(p => p.id === formData.producto_id)?.precio_compra || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cantidad:</span>
                        <span>{formData.cantidad}</span>
                      </div>
                      <div className="flex justify-between font-bold text-red-600 border-t pt-1">
                        <span>Costo total:</span>
                        <span>
                          {formatCurrency((productos.find(p => p.id === formData.producto_id)?.precio_compra || 0) * formData.cantidad)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="btn-secondary flex-1"
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary flex-1"
                    disabled={saving || !formData.producto_id}
                  >
                    {saving ? (
                      <>
                        <span className="spinner mr-2"></span>
                        Registrando...
                      </>
                    ) : (
                      'Registrar Pérdida'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}