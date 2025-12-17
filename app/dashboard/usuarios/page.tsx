'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'

interface Usuario {
  id: string
  auth_id: string
  email: string
  nombre: string
  telefono: string | null
  rol: 'admin' | 'gerente' | 'vendedor'
  activo: boolean
  created_at: string
}

// Permisos por defecto según rol
const PERMISOS_DEFAULT = {
  gerente: {
    dashboard: { ver: true },
    pos: { vender: true, editar_precio: true, aplicar_descuento: true },
    productos: { ver: true, crear: true, editar: true, registrar_perdida: true },
    ventas: { ver_propias: true, ver_todas: true, anular: true },
    caja: { ver: true, abrir: true, cerrar: true, retiros: true },
    compras: { ver: true, crear: true },
    gastos: { ver: true, crear: true },
    creditos: { ver: true, registrar_pago: true },
    clientes: { ver: true, crear: true, editar: true },
    reportes: { ver: true }
  },
  vendedor: {
    dashboard: { ver: true },
    pos: { vender: true, editar_precio: false, aplicar_descuento: false },
    productos: { ver: true, crear: false, editar: false, registrar_perdida: false },
    ventas: { ver_propias: true, ver_todas: false, anular: false },
    caja: { ver: true, abrir: true, cerrar: true, retiros: false },
    compras: { ver: false, crear: false },
    gastos: { ver: false, crear: false },
    creditos: { ver: false, registrar_pago: false },
    clientes: { ver: true, crear: true, editar: false },
    reportes: { ver: false }
  }
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Formulario
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    telefono: '',
    rol: 'vendedor' as 'gerente' | 'vendedor',
  })

  const { usuario } = useAuth()
  const supabase = createClient()

  // Solo gerentes y admins pueden gestionar usuarios
  const puedeGestionar = usuario?.rol === 'admin' || usuario?.rol === 'gerente'

  useEffect(() => {
    if (usuario?.sucursal_id) {
      fetchUsuarios()
    }
  }, [usuario?.sucursal_id])

  const fetchUsuarios = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('sucursal_id', usuario?.sucursal_id)
        .order('nombre')

      if (error) throw error
      setUsuarios(data || [])
    } catch (error) {
      console.error('Error fetching usuarios:', error)
    } finally {
      setLoading(false)
    }
  }

  const abrirModal = () => {
    setFormData({
      nombre: '',
      email: '',
      password: '',
      telefono: '',
      rol: 'vendedor',
    })
    setError('')
    setShowModal(true)
  }

  const cerrarModal = () => {
    setShowModal(false)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validaciones
    if (!formData.nombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    if (!formData.email.trim()) {
      setError('El email es obligatorio')
      return
    }
    if (!formData.password || formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setSaving(true)

    try {
      // 1. Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        options: {
          data: {
            nombre: formData.nombre.trim(),
          }
        }
      })

      if (authError) {
        if (authError.message.includes('already registered')) {
          setError('Este email ya está registrado')
        } else {
          setError(authError.message)
        }
        return
      }

      if (!authData.user) {
        setError('Error al crear el usuario')
        return
      }

      // 2. Crear registro en tabla usuarios
      const { error: dbError } = await supabase
        .from('usuarios')
        .insert({
          auth_id: authData.user.id,
          empresa_id: usuario?.empresa_id,
          sucursal_id: usuario?.sucursal_id,
          email: formData.email.trim().toLowerCase(),
          nombre: formData.nombre.trim(),
          telefono: formData.telefono.trim() || null,
          rol: formData.rol,
          activo: true,
          permisos: PERMISOS_DEFAULT[formData.rol],
        })

      if (dbError) {
        console.error('Error creating user record:', dbError)
        setError('Error al guardar el usuario en la base de datos')
        return
      }

      // Éxito
      await fetchUsuarios()
      cerrarModal()
      alert(`Usuario "${formData.nombre}" creado exitosamente.\n\nCredenciales:\nEmail: ${formData.email}\nContraseña: ${formData.password}`)

    } catch (error: any) {
      console.error('Error:', error)
      setError('Error inesperado al crear el usuario')
    } finally {
      setSaving(false)
    }
  }

  const toggleActivo = async (usuarioItem: Usuario) => {
    // No permitir desactivarse a sí mismo
    if (usuarioItem.id === usuario?.id) {
      alert('No puedes desactivarte a ti mismo')
      return
    }

    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ activo: !usuarioItem.activo })
        .eq('id', usuarioItem.id)

      if (error) throw error

      setUsuarios(prev =>
        prev.map(u =>
          u.id === usuarioItem.id ? { ...u, activo: !u.activo } : u
        )
      )
    } catch (error) {
      console.error('Error updating usuario:', error)
      alert('Error al actualizar el usuario')
    }
  }

  const getRolBadge = (rol: string) => {
    switch (rol) {
      case 'admin':
        return 'bg-red-100 text-red-700'
      case 'gerente':
        return 'bg-blue-100 text-blue-700'
      case 'vendedor':
        return 'bg-green-100 text-green-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getRolLabel = (rol: string) => {
    switch (rol) {
      case 'admin':
        return 'Administrador'
      case 'gerente':
        return 'Gerente'
      case 'vendedor':
        return 'Vendedor'
      default:
        return rol
    }
  }

  if (!puedeGestionar) {
    return (
      <div className="p-4 pb-24">
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Acceso Restringido</h3>
          <p className="mt-1 text-sm text-gray-500">
            No tienes permisos para gestionar usuarios
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-gray-600">Gestiona los usuarios de tu sucursal</p>
        </div>

        <button
          onClick={abrirModal}
          className="btn-primary"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nuevo
        </button>
      </div>

      {/* Lista de usuarios */}
      <div className="space-y-3">
        {usuarios.map((usuarioItem) => (
          <div
            key={usuarioItem.id}
            className={`bg-white rounded-xl p-4 shadow-sm border transition-all ${
              usuarioItem.activo ? 'border-gray-200' : 'border-orange-300 bg-orange-50 opacity-75'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {/* Avatar */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                  usuarioItem.activo ? 'bg-primary-500' : 'bg-gray-400'
                }`}>
                  {usuarioItem.nombre.charAt(0).toUpperCase()}
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-gray-900">{usuarioItem.nombre}</h3>
                    {usuarioItem.id === usuario?.id && (
                      <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                        Tú
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{usuarioItem.email}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRolBadge(usuarioItem.rol)}`}>
                      {getRolLabel(usuarioItem.rol)}
                    </span>
                    {!usuarioItem.activo && (
                      <span className="text-xs text-orange-600 font-medium">Inactivo</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Acciones */}
              {usuarioItem.id !== usuario?.id && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => toggleActivo(usuarioItem)}
                    className={`p-2 rounded-lg transition-colors ${
                      usuarioItem.activo
                        ? 'text-orange-500 hover:bg-orange-50'
                        : 'text-green-500 hover:bg-green-50'
                    }`}
                    title={usuarioItem.activo ? 'Desactivar' : 'Activar'}
                  >
                    {usuarioItem.activo ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {usuarios.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay usuarios</h3>
          <p className="mt-1 text-sm text-gray-500">
            Comienza agregando usuarios a tu sucursal
          </p>
          <button
            onClick={abrirModal}
            className="btn-primary mt-4"
          >
            Agregar Usuario
          </button>
        </div>
      )}

      {/* Modal Crear Usuario */}
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
                <h3 className="text-lg font-semibold text-gray-900">Nuevo Usuario</h3>
                <button
                  onClick={cerrarModal}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Nombre Completo *</label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="input"
                    placeholder="Ej: Juan Pérez"
                    required
                  />
                </div>

                <div>
                  <label className="label">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input"
                    placeholder="correo@ejemplo.com"
                    required
                  />
                </div>

                <div>
                  <label className="label">Contraseña *</label>
                  <input
                    type="text"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="input"
                    placeholder="Mínimo 6 caracteres"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    El usuario podrá cambiarla después
                  </p>
                </div>

                <div>
                  <label className="label">Teléfono</label>
                  <input
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    className="input"
                    placeholder="Opcional"
                  />
                </div>

                <div>
                  <label className="label">Rol *</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, rol: 'vendedor' })}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        formData.rol === 'vendedor'
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <svg className="w-8 h-8 text-green-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="font-medium text-gray-900">Vendedor</span>
                        <span className="text-xs text-gray-500 mt-1">Permisos básicos</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, rol: 'gerente' })}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        formData.rol === 'gerente'
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <svg className="w-8 h-8 text-blue-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <span className="font-medium text-gray-900">Gerente</span>
                        <span className="text-xs text-gray-500 mt-1">Permisos completos</span>
                      </div>
                    </button>
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
                        Creando...
                      </>
                    ) : (
                      'Crear Usuario'
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