'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import Image from 'next/image'

export default function ConfiguracionPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showExito, setShowExito] = useState(false)
  const [mensajeExito, setMensajeExito] = useState('')
  
  // Perfil
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  
  // Logo
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  
  // PIN
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinActual, setPinActual] = useState('')
  const [pinNuevo, setPinNuevo] = useState('')
  const [pinConfirmar, setPinConfirmar] = useState('')
  const [tienePinActual, setTienePinActual] = useState(false)
  
  // Contraseña
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordActual, setPasswordActual] = useState('')
  const [passwordNueva, setPasswordNueva] = useState('')
  const [passwordConfirmar, setPasswordConfirmar] = useState('')
  
  const [error, setError] = useState('')

  const { usuario } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (usuario?.id) {
      fetchData()
    }
  }, [usuario?.id])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Obtener datos del usuario
      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('nombre, telefono, email, pin')
        .eq('id', usuario?.id)
        .single()

      if (userError) throw userError

      if (userData) {
        setNombre(userData.nombre || '')
        setTelefono(userData.telefono || '')
        setEmail(userData.email || '')
        setTienePinActual(!!userData.pin)
      }

      // Obtener logo de la sucursal
      if (usuario?.sucursal_id) {
        const { data: sucursalData } = await supabase
          .from('sucursales')
          .select('logo_url')
          .eq('id', usuario.sucursal_id)
          .single()

        if (sucursalData?.logo_url) {
          setLogoUrl(sucursalData.logo_url)
        }
      }

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

  const guardarPerfil = async () => {
    if (!nombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }

    setSaving(true)
    setError('')

    try {
      const { error: updateError } = await supabase
        .from('usuarios')
        .update({
          nombre: nombre.trim(),
          telefono: telefono.trim() || null
        })
        .eq('id', usuario?.id)

      if (updateError) throw updateError

      mostrarExito('Perfil actualizado')
    } catch (err) {
      console.error('Error:', err)
      setError('Error al guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  const subirLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen')
      return
    }

    // Validar tamaño (máx 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen no debe superar 2MB')
      return
    }

    setUploadingLogo(true)

    try {
      // Generar nombre único
      const fileExt = file.name.split('.').pop()
      const fileName = `${usuario?.sucursal_id}-${Date.now()}.${fileExt}`
      const filePath = `logos/${fileName}`

      // Subir a Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Obtener URL pública
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath)

      // Actualizar base de datos
      const { error: updateError } = await supabase
        .from('sucursales')
        .update({ logo_url: urlData.publicUrl })
        .eq('id', usuario?.sucursal_id)

      if (updateError) throw updateError

      setLogoUrl(urlData.publicUrl)
      mostrarExito('Logo actualizado')

    } catch (err) {
      console.error('Error:', err)
      alert('Error al subir el logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  const eliminarLogo = async () => {
    if (!confirm('¿Eliminar el logo actual?')) return

    try {
      // Actualizar base de datos
      const { error } = await supabase
        .from('sucursales')
        .update({ logo_url: null })
        .eq('id', usuario?.sucursal_id)

      if (error) throw error

      setLogoUrl(null)
      mostrarExito('Logo eliminado')

    } catch (err) {
      console.error('Error:', err)
      alert('Error al eliminar el logo')
    }
  }

  const guardarPin = async () => {
    setError('')
    
    // Validaciones
    if (tienePinActual && !pinActual) {
      setError('Ingresa tu PIN actual')
      return
    }
    
    if (!pinNuevo || pinNuevo.length !== 4) {
      setError('El PIN debe tener 4 dígitos')
      return
    }
    
    if (pinNuevo !== pinConfirmar) {
      setError('Los PIN no coinciden')
      return
    }

    if (!/^\d{4}$/.test(pinNuevo)) {
      setError('El PIN debe ser numérico')
      return
    }

    setSaving(true)

    try {
      // Si tiene PIN actual, verificarlo
      if (tienePinActual) {
        const { data: userData } = await supabase
          .from('usuarios')
          .select('pin')
          .eq('id', usuario?.id)
          .single()
        
        if (userData?.pin !== pinActual) {
          setError('El PIN actual es incorrecto')
          setSaving(false)
          return
        }
      }

      const { error: updateError } = await supabase
        .from('usuarios')
        .update({ pin: pinNuevo })
        .eq('id', usuario?.id)

      if (updateError) throw updateError

      setShowPinModal(false)
      setPinActual('')
      setPinNuevo('')
      setPinConfirmar('')
      setTienePinActual(true)
      mostrarExito('PIN configurado correctamente')
    } catch (err) {
      console.error('Error:', err)
      setError('Error al guardar el PIN')
    } finally {
      setSaving(false)
    }
  }

  const cambiarPassword = async () => {
    setError('')

    if (!passwordActual) {
      setError('Ingresa tu contraseña actual')
      return
    }

    if (!passwordNueva || passwordNueva.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres')
      return
    }

    if (passwordNueva !== passwordConfirmar) {
      setError('Las contraseñas no coinciden')
      return
    }

    setSaving(true)

    try {
      const { error: authError } = await supabase.auth.updateUser({
        password: passwordNueva
      })

      if (authError) throw authError

      setShowPasswordModal(false)
      setPasswordActual('')
      setPasswordNueva('')
      setPasswordConfirmar('')
      mostrarExito('Contraseña actualizada')
    } catch (err: any) {
      console.error('Error:', err)
      setError(err.message || 'Error al cambiar la contraseña')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-40 bg-gray-200 rounded-xl"></div>
          <div className="h-40 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto">
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

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500 text-sm">Gestiona tu perfil y negocio</p>
      </div>

      {/* Mi Perfil */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Mi Perfil</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              placeholder="Tu nombre"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              placeholder="Tu teléfono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
            />
            <p className="text-xs text-gray-400 mt-1">El email no se puede cambiar</p>
          </div>

          <button
            onClick={guardarPerfil}
            disabled={saving}
            className="w-full py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>

      {/* Logo del Negocio */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Logo del Negocio</h2>
        <p className="text-sm text-gray-500 mb-4">Este logo aparecerá en las cotizaciones</p>
        
        <div className="space-y-4">
          {logoUrl ? (
            <div className="flex items-center gap-4">
              <div className="relative w-32 h-32 border-2 border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                <Image
                  src={logoUrl}
                  alt="Logo"
                  fill
                  className="object-contain p-2"
                />
              </div>
              <div className="flex-1 space-y-2">
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={subirLogo}
                    className="hidden"
                    disabled={uploadingLogo}
                  />
                  <span className="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 cursor-pointer text-sm">
                    {uploadingLogo ? 'Subiendo...' : 'Cambiar Logo'}
                  </span>
                </label>
                <button
                  onClick={eliminarLogo}
                  className="block px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm"
                >
                  Eliminar Logo
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-emerald-500 transition-colors bg-gray-50">
                <input
                  type="file"
                  accept="image/*"
                  onChange={subirLogo}
                  className="hidden"
                  disabled={uploadingLogo}
                />
                <div className="text-center">
                  {uploadingLogo ? (
                    <>
                      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-sm text-gray-600">Subiendo...</p>
                    </>
                  ) : (
                    <>
                      <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm text-gray-600 mb-1">Haz clic para subir un logo</p>
                      <p className="text-xs text-gray-400">PNG, JPG, WEBP (máx. 2MB)</p>
                    </>
                  )}
                </div>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Seguridad */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Seguridad</h2>
        
        <div className="space-y-3">
          <button
            onClick={() => { setError(''); setShowPinModal(true) }}
            className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">{tienePinActual ? 'Cambiar PIN' : 'Configurar PIN'}</p>
                <p className="text-xs text-gray-500">Para confirmar operaciones importantes</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={() => { setError(''); setShowPasswordModal(true) }}
            className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Cambiar Contraseña</p>
                <p className="text-xs text-gray-500">Actualiza tu contraseña de acceso</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Modal PIN */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                {tienePinActual ? 'Cambiar PIN' : 'Configurar PIN'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                El PIN se usa para confirmar operaciones importantes como anular ventas o hacer retiros de caja
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {tienePinActual && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PIN Actual</label>
                  <input
                    type="password"
                    value={pinActual}
                    onChange={(e) => setPinActual(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-center text-2xl tracking-widest"
                    placeholder="••••"
                    maxLength={4}
                    inputMode="numeric"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nuevo PIN (4 dígitos)</label>
                <input
                  type="password"
                  value={pinNuevo}
                  onChange={(e) => setPinNuevo(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-center text-2xl tracking-widest"
                  placeholder="••••"
                  maxLength={4}
                  inputMode="numeric"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar PIN</label>
                <input
                  type="password"
                  value={pinConfirmar}
                  onChange={(e) => setPinConfirmar(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-center text-2xl tracking-widest"
                  placeholder="••••"
                  maxLength={4}
                  inputMode="numeric"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setShowPinModal(false)
                  setPinActual('')
                  setPinNuevo('')
                  setPinConfirmar('')
                  setError('')
                }}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={guardarPin}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Contraseña */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Cambiar Contraseña</h2>
              <p className="text-sm text-gray-500 mt-1">
                Ingresa tu contraseña actual y la nueva
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña Actual</label>
                <input
                  type="password"
                  value={passwordActual}
                  onChange={(e) => setPasswordActual(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Contraseña</label>
                <input
                  type="password"
                  value={passwordNueva}
                  onChange={(e) => setPasswordNueva(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Nueva Contraseña</label>
                <input
                  type="password"
                  value={passwordConfirmar}
                  onChange={(e) => setPasswordConfirmar(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  placeholder="Repite la contraseña"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setShowPasswordModal(false)
                  setPasswordActual('')
                  setPasswordNueva('')
                  setPasswordConfirmar('')
                  setError('')
                }}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={cambiarPassword}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Cambiar'}
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