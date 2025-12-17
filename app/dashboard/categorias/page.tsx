'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { Categoria } from '@/types/database'

// Colores disponibles para categorías
const COLORES_DISPONIBLES = [
  { nombre: 'Ámbar', valor: '#F59E0B' },
  { nombre: 'Violeta', valor: '#8B5CF6' },
  { nombre: 'Naranja', valor: '#D97706' },
  { nombre: 'Cyan', valor: '#0891B2' },
  { nombre: 'Índigo', valor: '#6366F1' },
  { nombre: 'Esmeralda', valor: '#10B981' },
  { nombre: 'Teal', valor: '#14B8A6' },
  { nombre: 'Rosa', valor: '#EC4899' },
  { nombre: 'Rojo', valor: '#EF4444' },
  { nombre: 'Azul', valor: '#3B82F6' },
  { nombre: 'Lima', valor: '#84CC16' },
  { nombre: 'Gris', valor: '#737373' },
  { nombre: 'Gris Claro', valor: '#9CA3AF' },
]

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Categoria | null>(null)
  const [saving, setSaving] = useState(false)
  
  // Formulario
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    color: '#10B981',
  })

  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (usuario?.empresa_id) {
      fetchCategorias()
    }
  }, [usuario?.empresa_id])

  const fetchCategorias = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('empresa_id', usuario?.empresa_id)
        .order('orden')

      if (error) throw error
      setCategorias(data || [])
    } catch (error) {
      console.error('Error fetching categorias:', error)
    } finally {
      setLoading(false)
    }
  }

  const abrirModalNueva = () => {
    setEditando(null)
    setFormData({
      nombre: '',
      descripcion: '',
      color: '#10B981',
    })
    setShowModal(true)
  }

  const abrirModalEditar = (categoria: Categoria) => {
    setEditando(categoria)
    setFormData({
      nombre: categoria.nombre,
      descripcion: categoria.descripcion || '',
      color: categoria.color || '#10B981',
    })
    setShowModal(true)
  }

  const cerrarModal = () => {
    setShowModal(false)
    setEditando(null)
    setFormData({
      nombre: '',
      descripcion: '',
      color: '#10B981',
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.nombre.trim()) {
      alert('El nombre de la categoría es obligatorio')
      return
    }

    setSaving(true)

    try {
      if (editando) {
        // Actualizar categoría existente
        const { error } = await supabase
          .from('categorias')
          .update({
            nombre: formData.nombre.trim(),
            descripcion: formData.descripcion.trim() || null,
            color: formData.color,
          })
          .eq('id', editando.id)

        if (error) throw error
      } else {
        // Crear nueva categoría
        const maxOrden = categorias.length > 0 
          ? Math.max(...categorias.map(c => c.orden || 0)) 
          : 0

        const { error } = await supabase
          .from('categorias')
          .insert({
            empresa_id: usuario?.empresa_id,
            nombre: formData.nombre.trim(),
            descripcion: formData.descripcion.trim() || null,
            color: formData.color,
            orden: maxOrden + 1,
            activa: true,
          })

        if (error) throw error
      }

      await fetchCategorias()
      cerrarModal()
    } catch (error: any) {
      console.error('Error saving categoria:', error)
      if (error.code === '23505') {
        alert('Ya existe una categoría con ese nombre')
      } else {
        alert('Error al guardar la categoría')
      }
    } finally {
      setSaving(false)
    }
  }

  const toggleActiva = async (categoria: Categoria) => {
    try {
      const { error } = await supabase
        .from('categorias')
        .update({ activa: !categoria.activa })
        .eq('id', categoria.id)

      if (error) throw error

      setCategorias(prev =>
        prev.map(c =>
          c.id === categoria.id ? { ...c, activa: !c.activa } : c
        )
      )
    } catch (error) {
      console.error('Error updating categoria:', error)
      alert('Error al actualizar la categoría')
    }
  }

  const eliminarCategoria = async (categoria: Categoria) => {
    if (!confirm(`¿Estás seguro de eliminar la categoría "${categoria.nombre}"?\n\nLos productos de esta categoría quedarán sin categoría asignada.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('categorias')
        .delete()
        .eq('id', categoria.id)

      if (error) throw error

      setCategorias(prev => prev.filter(c => c.id !== categoria.id))
    } catch (error) {
      console.error('Error deleting categoria:', error)
      alert('Error al eliminar la categoría')
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-xl"></div>
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
          <p className="text-gray-600">Organiza tus productos por categorías</p>
        </div>
        
        <button
          onClick={abrirModalNueva}
          className="btn-primary"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nueva
        </button>
      </div>

      {/* Lista de categorías */}
      <div className="space-y-3">
        {categorias.map((categoria) => (
          <div
            key={categoria.id}
            className={`bg-white rounded-xl p-4 shadow-sm border transition-all ${
              categoria.activa ? 'border-gray-200' : 'border-orange-300 bg-orange-50 opacity-75'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {/* Color indicator */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: categoria.color || '#10B981' }}
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900">{categoria.nombre}</h3>
                  {categoria.descripcion && (
                    <p className="text-sm text-gray-500">{categoria.descripcion}</p>
                  )}
                  {!categoria.activa && (
                    <span className="text-xs text-orange-600 font-medium">Inactiva</span>
                  )}
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => abrirModalEditar(categoria)}
                  className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                  title="Editar"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>

                <button
                  onClick={() => toggleActiva(categoria)}
                  className={`p-2 rounded-lg transition-colors ${
                    categoria.activa
                      ? 'text-orange-500 hover:bg-orange-50'
                      : 'text-green-500 hover:bg-green-50'
                  }`}
                  title={categoria.activa ? 'Desactivar' : 'Activar'}
                >
                  {categoria.activa ? (
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

                <button
                  onClick={() => eliminarCategoria(categoria)}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Eliminar"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {categorias.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay categorías</h3>
          <p className="mt-1 text-sm text-gray-500">
            Comienza creando tu primera categoría
          </p>
          <button
            onClick={abrirModalNueva}
            className="btn-primary mt-4"
          >
            Crear Categoría
          </button>
        </div>
      )}

      {/* Modal Crear/Editar */}
      {showModal && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
          onClick={cerrarModal}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editando ? 'Editar Categoría' : 'Nueva Categoría'}
                </h3>
                <button
                  onClick={cerrarModal}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Nombre *</label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="input"
                    placeholder="Ej: Bebidas Importadas"
                    required
                  />
                </div>

                <div>
                  <label className="label">Descripción</label>
                  <textarea
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    className="input"
                    rows={2}
                    placeholder="Descripción opcional..."
                  />
                </div>

                <div>
                  <label className="label">Color</label>
                  <div className="grid grid-cols-7 gap-2">
                    {COLORES_DISPONIBLES.map((color) => (
                      <button
                        key={color.valor}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: color.valor })}
                        className={`w-10 h-10 rounded-lg transition-all ${
                          formData.color === color.valor
                            ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: color.valor }}
                        title={color.nombre}
                      />
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-2">Vista previa:</p>
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: formData.color }}
                    >
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    </div>
                    <span className="font-medium text-gray-900">
                      {formData.nombre || 'Nombre de categoría'}
                    </span>
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={cerrarModal}
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
                      editando ? 'Actualizar' : 'Crear'
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