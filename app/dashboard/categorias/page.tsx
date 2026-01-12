// Path: app\dashboard\categorias\page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'

interface Categoria {
  id: string
  nombre: string
  color: string
  activa: boolean
  orden: number
}

const COLORES = [
  '#F59E0B', '#8B5CF6', '#D97706', '#0891B2', '#6366F1',
  '#10B981', '#14B8A6', '#EC4899', '#EF4444', '#3B82F6',
  '#84CC16', '#737373', '#9CA3AF'
]

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showExito, setShowExito] = useState(false)
  const [showEliminar, setShowEliminar] = useState(false)
  const [categoriaAEliminar, setCategoriaAEliminar] = useState<Categoria | null>(null)
  const [mensajeExito, setMensajeExito] = useState('')
  const [editando, setEditando] = useState<Categoria | null>(null)
  const [saving, setSaving] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [error, setError] = useState('')
  
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState('#10B981')

  const { usuario } = useAuth()
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
        .order('nombre') // Ordenar alfabéticamente A-Z

      if (error) throw error
      setCategorias(data || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const mostrarExito = (mensaje: string) => {
    setMensajeExito(mensaje)
    setShowExito(true)
    setTimeout(() => setShowExito(false), 2500)
  }

  const abrirModal = (categoria?: Categoria) => {
    if (categoria) {
      setEditando(categoria)
      setNombre(categoria.nombre)
      setColor(categoria.color)
    } else {
      setEditando(null)
      setNombre('')
      setColor('#10B981')
    }
    setError('')
    setShowModal(true)
  }

  const cerrarModal = () => {
    setShowModal(false)
    setEditando(null)
    setError('')
  }

  const handleSubmit = async () => {
    if (!nombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }

    setSaving(true)
    setError('')

    try {
      if (editando) {
        const { error: updateError } = await supabase
          .from('categorias')
          .update({ nombre: nombre.trim(), color })
          .eq('id', editando.id)

        if (updateError) throw updateError
        mostrarExito('Categoría actualizada')
      } else {
        const { error: insertError } = await supabase
          .from('categorias')
          .insert({
            empresa_id: usuario?.empresa_id,
            nombre: nombre.trim(),
            color,
            activa: true
          })

        if (insertError) throw insertError
        mostrarExito('Categoría creada')
      }

      await fetchCategorias()
      cerrarModal()
    } catch (err: any) {
      console.error('Error:', err)
      setError(err.message || 'Error al guardar')
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
        prev.map(c => c.id === categoria.id ? { ...c, activa: !c.activa } : c)
      )
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const abrirEliminar = (categoria: Categoria) => {
    setCategoriaAEliminar(categoria)
    setError('')
    setShowEliminar(true)
  }

  const eliminarCategoria = async () => {
    if (!categoriaAEliminar) return

    setEliminando(true)
    setError('')

    try {
      // Verificar si hay productos usando esta categoría
      const { data: productos, error: checkError } = await supabase
        .from('productos')
        .select('id')
        .eq('categoria_id', categoriaAEliminar.id)
        .limit(1)

      if (checkError) throw checkError

      if (productos && productos.length > 0) {
        setError('No se puede eliminar: hay productos usando esta categoría')
        setEliminando(false)
        return
      }

      // Eliminar la categoría
      const { error: deleteError } = await supabase
        .from('categorias')
        .delete()
        .eq('id', categoriaAEliminar.id)

      if (deleteError) throw deleteError

      mostrarExito('Categoría eliminada')
      setShowEliminar(false)
      setCategoriaAEliminar(null)
      await fetchCategorias()
    } catch (err: any) {
      console.error('Error:', err)
      setError(err.message || 'Error al eliminar')
    } finally {
      setEliminando(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-gray-200 rounded-xl"></div>)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24">
      {/* Modal Éxito */}
      {showExito && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full animate-bounce-in">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">{mensajeExito}</h2>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
          <p className="text-gray-500 text-sm">{categorias.length} categoría(s) • Ordenadas A-Z</p>
        </div>
        <button
          onClick={() => abrirModal()}
          className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva
        </button>
      </div>

      {/* Grid de categorías */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {categorias.map((categoria) => (
          <div
            key={categoria.id}
            className={`bg-white rounded-xl p-4 border transition-all ${categoria.activa ? 'border-gray-100' : 'border-gray-200 opacity-50'}`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: categoria.color + '20' }}
              >
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: categoria.color }}
                ></div>
              </div>
              <span className="font-medium text-gray-900 flex-1 truncate">{categoria.nombre}</span>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => abrirModal(categoria)}
                className="flex-1 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
              >
                Editar
              </button>
              <button
                onClick={() => toggleActiva(categoria)}
                className={`flex-1 py-1.5 text-sm rounded-lg ${categoria.activa ? 'text-orange-600 bg-orange-50 hover:bg-orange-100' : 'text-green-600 bg-green-50 hover:bg-green-100'}`}
              >
                {categoria.activa ? 'Desactivar' : 'Activar'}
              </button>
              <button
                onClick={() => abrirEliminar(categoria)}
                className="px-3 py-1.5 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                title="Eliminar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {categorias.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900">No hay categorías</h3>
          <p className="text-gray-500">Comienza creando tu primera categoría</p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                {editando ? 'Editar Categoría' : 'Nueva Categoría'}
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  placeholder="Ej: Cervezas"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLORES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-lg transition-all ${color === c ? 'ring-2 ring-offset-2 ring-emerald-500 scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={cerrarModal}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Eliminar */}
      {showEliminar && categoriaAEliminar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm animate-bounce-in">
            <div className="p-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
                ¿Eliminar categoría?
              </h3>
              <p className="text-gray-500 text-center text-sm mb-4">
                Se eliminará: <strong>{categoriaAEliminar.nombre}</strong>
                <br />
                Esta acción no se puede deshacer
              </p>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowEliminar(false)
                    setCategoriaAEliminar(null)
                    setError('')
                  }}
                  disabled={eliminando}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={eliminarCategoria}
                  disabled={eliminando}
                  className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:opacity-50 font-medium"
                >
                  {eliminando ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
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