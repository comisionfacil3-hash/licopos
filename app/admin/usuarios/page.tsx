// Path: app\admin\usuarios\page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Empresa, Sucursal, Usuario } from '@/types/database'
import { DEFAULT_PERMISSIONS } from '@/constants/permissions'

// Definir tipo separado sin extender Usuario para evitar conflictos
interface UsuarioCompleto {
  id: string
  auth_id: string
  empresa_id: string
  sucursal_id: string | null
  email: string
  nombre: string
  telefono: string | null
  rol: 'admin' | 'gerente' | 'vendedor'
  activo: boolean
  permisos: Record<string, unknown>
  ultimo_acceso: string | null
  created_at: string
  updated_at: string
  empresa: Empresa | null
  sucursal: Sucursal | null
}

export default function UsuariosAdminPage() {
  const [usuarios, setUsuarios] = useState<UsuarioCompleto[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UsuarioCompleto | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    telefono: '',
    empresa_id: '',
    sucursal_id: '',
    rol: 'vendedor' as 'admin' | 'gerente' | 'vendedor',
    activo: true
  })

  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // Cargar usuarios con relaciones
      const { data: usuariosData, error: usuariosError } = await supabase
        .from('usuarios')
        .select(`
          *,
          empresa:empresas(*),
          sucursal:sucursales(*)
        `)
        .order('nombre')

      if (usuariosError) throw usuariosError
      setUsuarios(usuariosData || [])

      // Cargar empresas
      const { data: empresasData, error: empresasError } = await supabase
        .from('empresas')
        .select('*')
        .eq('activa', true)
        .order('nombre')

      if (empresasError) throw empresasError
      setEmpresas(empresasData || [])

      // Cargar sucursales
      const { data: sucursalesData, error: sucursalesError } = await supabase
        .from('sucursales')
        .select('*')
        .eq('activa', true)
        .order('nombre')

      if (sucursalesError) throw sucursalesError
      setSucursales(sucursalesData || [])
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    setEditingUser(null)
    setFormData({
      nombre: '',
      email: '',
      password: '',
      telefono: '',
      empresa_id: '',
      sucursal_id: '',
      rol: 'vendedor',
      activo: true
    })
    setError('')
    setShowModal(true)
  }

  const openEditModal = (usuario: UsuarioCompleto) => {
    setEditingUser(usuario)
    setFormData({
      nombre: usuario.nombre,
      email: usuario.email,
      password: '',
      telefono: usuario.telefono || '',
      empresa_id: usuario.empresa_id,
      sucursal_id: usuario.sucursal_id || '',
      rol: usuario.rol,
      activo: usuario.activo
    })
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    setError('')
    
    // Validaciones
    if (!formData.nombre.trim()) {
      setError('El nombre es requerido')
      return
    }
    if (!formData.email.trim()) {
      setError('El email es requerido')
      return
    }
    if (!editingUser && !formData.password) {
      setError('La contraseña es requerida para nuevos usuarios')
      return
    }
    if (!formData.empresa_id) {
      setError('Debe seleccionar una empresa')
      return
    }
    if (formData.rol !== 'admin' && !formData.sucursal_id) {
      setError('Debe seleccionar una sucursal para gerentes y vendedores')
      return
    }

    setSaving(true)
    try {
      if (editingUser) {
        // Actualizar usuario existente
        const updateData: Record<string, unknown> = {
          nombre: formData.nombre.trim(),
          telefono: formData.telefono.trim() || null,
          empresa_id: formData.empresa_id,
          sucursal_id: formData.rol === 'admin' ? null : formData.sucursal_id,
          rol: formData.rol,
          activo: formData.activo,
          permisos: DEFAULT_PERMISSIONS[formData.rol]
        }

        const { error: updateError } = await supabase
          .from('usuarios')
          .update(updateData)
          .eq('id', editingUser.id)

        if (updateError) throw updateError
      } else {
        // Crear nuevo usuario
        // Primero crear en auth.users
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email.trim(),
          password: formData.password,
          options: {
            data: {
              nombre: formData.nombre.trim()
            }
          }
        })

        if (authError) throw authError
        if (!authData.user) throw new Error('No se pudo crear el usuario')

        // Crear en tabla usuarios
        const { error: insertError } = await supabase
          .from('usuarios')
          .insert({
            auth_id: authData.user.id,
            email: formData.email.trim(),
            nombre: formData.nombre.trim(),
            telefono: formData.telefono.trim() || null,
            empresa_id: formData.empresa_id,
            sucursal_id: formData.rol === 'admin' ? null : formData.sucursal_id,
            rol: formData.rol,
            activo: formData.activo,
            permisos: DEFAULT_PERMISSIONS[formData.rol]
          })

        if (insertError) throw insertError
      }

      setShowModal(false)
      loadData()
    } catch (err: unknown) {
      console.error('Error guardando usuario:', err)
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Error al guardar el usuario')
      }
    } finally {
      setSaving(false)
    }
  }

  const toggleUserStatus = async (usuario: UsuarioCompleto) => {
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ activo: !usuario.activo })
        .eq('id', usuario.id)

      if (error) throw error
      loadData()
    } catch (err) {
      console.error('Error actualizando estado:', err)
    }
  }

  // Filtrar sucursales por empresa seleccionada
  const sucursalesFiltradas = sucursales.filter(s => s.empresa_id === formData.empresa_id)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando usuarios...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-gray-500 text-sm">{usuarios.length} usuarios registrados</p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium"
        >
          + Nuevo Usuario
        </button>
      </div>

      {/* Lista de usuarios */}
      {usuarios.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No hay usuarios</h3>
          <p className="text-gray-500 mb-4">Comienza creando el primer usuario</p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
          >
            + Crear Usuario
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Usuario</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 hidden sm:table-cell">Empresa</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 hidden md:table-cell">Sucursal</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Rol</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Estado</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {usuarios.map(usuario => (
                  <tr key={usuario.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{usuario.nombre}</p>
                        <p className="text-sm text-gray-500">{usuario.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-gray-600">{usuario.empresa?.nombre || '-'}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-gray-600">{usuario.sucursal?.nombre || 'Todas'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        usuario.rol === 'admin' 
                          ? 'bg-purple-100 text-purple-700'
                          : usuario.rol === 'gerente'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {usuario.rol.charAt(0).toUpperCase() + usuario.rol.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleUserStatus(usuario)}
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          usuario.activo 
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {usuario.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEditModal(usuario)}
                        className="text-emerald-600 hover:text-emerald-700 font-medium text-sm"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={e => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  placeholder="Nombre completo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  disabled={!!editingUser}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none disabled:bg-gray-100"
                  placeholder="correo@ejemplo.com"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={formData.telefono}
                  onChange={e => setFormData(prev => ({ ...prev, telefono: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  placeholder="Opcional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Empresa *</label>
                <select
                  value={formData.empresa_id}
                  onChange={e => setFormData(prev => ({ ...prev, empresa_id: e.target.value, sucursal_id: '' }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white"
                >
                  <option value="">Seleccionar empresa</option>
                  {empresas.map(empresa => (
                    <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol *</label>
                <select
                  value={formData.rol}
                  onChange={e => setFormData(prev => ({ ...prev, rol: e.target.value as 'admin' | 'gerente' | 'vendedor' }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white"
                >
                  <option value="admin">Administrador (todas las sucursales)</option>
                  <option value="gerente">Gerente (una sucursal)</option>
                  <option value="vendedor">Vendedor (una sucursal)</option>
                </select>
              </div>

              {formData.rol !== 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal *</label>
                  <select
                    value={formData.sucursal_id}
                    onChange={e => setFormData(prev => ({ ...prev, sucursal_id: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white"
                    disabled={!formData.empresa_id}
                  >
                    <option value="">Seleccionar sucursal</option>
                    {sucursalesFiltradas.map(sucursal => (
                      <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>
                    ))}
                  </select>
                  {formData.empresa_id && sucursalesFiltradas.length === 0 && (
                    <p className="text-sm text-amber-600 mt-1">Esta empresa no tiene sucursales activas</p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activo"
                  checked={formData.activo}
                  onChange={e => setFormData(prev => ({ ...prev, activo: e.target.checked }))}
                  className="w-4 h-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500"
                />
                <label htmlFor="activo" className="text-sm text-gray-700">Usuario activo</label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}