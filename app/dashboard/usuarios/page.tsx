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
  permisos: any
  created_at: string
}

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

const PERMISOS_LABELS: Record<string, Record<string, string>> = {
  pos: { vender: 'Realizar ventas', editar_precio: 'Editar precios', aplicar_descuento: 'Aplicar descuentos' },
  productos: { ver: 'Ver productos', crear: 'Crear productos', editar: 'Editar productos', registrar_perdida: 'Registrar pérdidas' },
  caja: { ver: 'Ver caja', abrir: 'Abrir caja', cerrar: 'Cerrar caja', retiros: 'Hacer retiros' },
  ventas: { ver_propias: 'Ver ventas propias', ver_todas: 'Ver todas las ventas', anular: 'Anular ventas' },
  compras: { ver: 'Ver compras', crear: 'Registrar compras' },
  gastos: { ver: 'Ver gastos', crear: 'Registrar gastos' },
  creditos: { ver: 'Ver créditos', registrar_pago: 'Registrar pagos' },
  clientes: { ver: 'Ver clientes', crear: 'Crear clientes', editar: 'Editar clientes' },
  reportes: { ver: 'Ver reportes' }
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showExitoModal, setShowExitoModal] = useState(false)
  const [credencialesCreadas, setCredencialesCreadas] = useState({ email: '', password: '' })
  const [showPermisosModal, setShowPermisosModal] = useState(false)
  const [usuarioPermisos, setUsuarioPermisos] = useState<Usuario | null>(null)
  const [permisosTemp, setPermisosTemp] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    telefono: '',
    rol: 'vendedor' as 'gerente' | 'vendedor',
  })

  const { usuario } = useAuth()
  const supabase = createClient()

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
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const abrirModal = () => {
    setFormData({ nombre: '', email: '', password: '', telefono: '', rol: 'vendedor' })
    setError('')
    setShowModal(true)
  }

  const cerrarModal = () => {
    setShowModal(false)
    setError('')
  }

  const handleSubmit = async () => {
    if (!formData.nombre.trim() || !formData.email.trim() || !formData.password.trim()) {
      setError('Nombre, email y contraseña son obligatorios')
      return
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setSaving(true)
    setError('')

    try {
      // Crear en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        options: { data: { nombre: formData.nombre.trim() } }
      })

      if (authError) {
        if (authError.message.includes('already registered')) {
          setError('Este email ya está registrado')
        } else {
          setError(authError.message)
        }
        setSaving(false)
        return
      }

      if (!authData.user) {
        setError('Error al crear el usuario')
        setSaving(false)
        return
      }

      // Crear en tabla usuarios
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
        setError('Error al guardar el usuario')
        return
      }

      // Mostrar modal de éxito con credenciales
      setCredencialesCreadas({
        email: formData.email.trim().toLowerCase(),
        password: formData.password
      })
      
      await fetchUsuarios()
      cerrarModal()
      setShowExitoModal(true)

    } catch (error: any) {
      console.error('Error:', error)
      setError('Error inesperado al crear el usuario')
    } finally {
      setSaving(false)
    }
  }

  const toggleActivo = async (usuarioItem: Usuario) => {
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
        prev.map(u => u.id === usuarioItem.id ? { ...u, activo: !u.activo } : u)
      )
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const abrirPermisos = (usuarioItem: Usuario) => {
    setUsuarioPermisos(usuarioItem)
    setPermisosTemp(usuarioItem.permisos || PERMISOS_DEFAULT.vendedor)
    setShowPermisosModal(true)
  }

  const togglePermiso = (modulo: string, permiso: string) => {
    setPermisosTemp((prev: any) => ({
      ...prev,
      [modulo]: {
        ...prev[modulo],
        [permiso]: !prev[modulo]?.[permiso]
      }
    }))
  }

  const guardarPermisos = async () => {
    if (!usuarioPermisos) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ permisos: permisosTemp })
        .eq('id', usuarioPermisos.id)

      if (error) throw error

      setUsuarios(prev =>
        prev.map(u => u.id === usuarioPermisos.id ? { ...u, permisos: permisosTemp } : u)
      )
      setShowPermisosModal(false)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setSaving(false)
    }
  }

  const getRolBadge = (rol: string) => {
    switch (rol) {
      case 'admin': return 'bg-red-100 text-red-700'
      case 'gerente': return 'bg-blue-100 text-blue-700'
      case 'vendedor': return 'bg-green-100 text-green-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getRolLabel = (rol: string) => {
    switch (rol) {
      case 'admin': return 'Administrador'
      case 'gerente': return 'Gerente'
      case 'vendedor': return 'Vendedor'
      default: return rol
    }
  }

  if (!puedeGestionar) {
    return (
      <div className="p-4 pb-24">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900">Acceso Restringido</h3>
          <p className="text-gray-500">No tienes permisos para gestionar usuarios</p>
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
      {/* Modal Éxito con Credenciales */}
      {showExitoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm animate-bounce-in">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">¡Usuario Creado!</h2>
              <p className="text-gray-500 mb-4">Guarda estas credenciales</p>
              
              <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2">
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="font-mono text-sm font-medium text-gray-900">{credencialesCreadas.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Contraseña</p>
                  <p className="font-mono text-sm font-medium text-gray-900">{credencialesCreadas.password}</p>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100">
              <button
                onClick={() => setShowExitoModal(false)}
                className="w-full py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-gray-500 text-sm">Gestiona los usuarios de tu sucursal</p>
        </div>
        <button onClick={abrirModal} className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo
        </button>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {usuarios.map((usuarioItem) => (
          <div key={usuarioItem.id} className={`bg-white rounded-xl p-4 shadow-sm border transition-all ${usuarioItem.activo ? 'border-gray-100' : 'border-orange-200 bg-orange-50'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${usuarioItem.activo ? 'bg-emerald-500' : 'bg-gray-400'}`}>
                  {usuarioItem.nombre.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{usuarioItem.nombre}</h3>
                  <p className="text-sm text-gray-500">{usuarioItem.email}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRolBadge(usuarioItem.rol)}`}>
                {getRolLabel(usuarioItem.rol)}
              </span>
            </div>

            {usuarioItem.id !== usuario?.id && (
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                {usuarioItem.rol === 'vendedor' && (
                  <button
                    onClick={() => abrirPermisos(usuarioItem)}
                    className="flex-1 py-2 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                  >
                    Permisos
                  </button>
                )}
                <button
                  onClick={() => toggleActivo(usuarioItem)}
                  className={`flex-1 py-2 text-sm rounded-lg ${usuarioItem.activo ? 'text-orange-600 bg-orange-50 hover:bg-orange-100' : 'text-green-600 bg-green-50 hover:bg-green-100'}`}
                >
                  {usuarioItem.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {usuarios.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900">No hay usuarios</h3>
          <p className="text-gray-500">Comienza agregando usuarios</p>
        </div>
      )}

      {/* Modal Crear Usuario */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Nuevo Usuario</h2>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input type="text" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Nombre completo" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="correo@ejemplo.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
                <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Mínimo 6 caracteres" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input type="tel" value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Opcional" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select value={formData.rol} onChange={(e) => setFormData({ ...formData, rol: e.target.value as any })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none">
                  <option value="vendedor">Vendedor</option>
                  <option value="gerente">Gerente</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button onClick={cerrarModal} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSubmit} disabled={saving} className="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50">
                {saving ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Permisos */}
      {showPermisosModal && usuarioPermisos && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Permisos de {usuarioPermisos.nombre}</h2>
              <p className="text-sm text-gray-500">Configura qué puede hacer este vendedor</p>
            </div>
            <div className="p-6 space-y-6">
              {Object.entries(PERMISOS_LABELS).map(([modulo, permisos]) => (
                <div key={modulo}>
                  <h3 className="font-medium text-gray-900 capitalize mb-3">{modulo}</h3>
                  <div className="space-y-2">
                    {Object.entries(permisos).map(([key, label]) => (
                      <label key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                        <span className="text-sm text-gray-700">{label}</span>
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={permisosTemp[modulo]?.[key] || false}
                            onChange={() => togglePermiso(modulo, key)}
                            className="sr-only"
                          />
                          <div className={`w-10 h-6 rounded-full transition-colors ${permisosTemp[modulo]?.[key] ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform mt-1 ${permisosTemp[modulo]?.[key] ? 'translate-x-5' : 'translate-x-1'}`}></div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowPermisosModal(false)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50">Cancelar</button>
              <button onClick={guardarPermisos} disabled={saving} className="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
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
