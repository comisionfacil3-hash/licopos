// Path: app\dashboard\configuracion\page.tsx
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

  // Costos Fijos - AGREGADO
  const [costosFijos, setCostosFijos] = useState({
    alquiler: 0,
    servicios: 0,
    sueldos: 0,
    otros: 0
  })

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

        // Obtener costos fijos de la sucursal - AGREGADO
        const { data: costosData } = await supabase
          .from('costos_fijos')
          .select('*')
          .eq('sucursal_id', usuario.sucursal_id)
          .single()

        if (costosData) {
          setCostosFijos({
            alquiler: parseFloat(costosData.alquiler_mensual) || 0,
            servicios: parseFloat(costosData.servicios_mensuales) || 0,
            sueldos: parseFloat(costosData.sueldos_mensuales) || 0,
            otros: parseFloat(costosData.otros_gastos_mensuales) || 0
          })
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
      // Si tiene PIN actual, verificarlo primero
      if (tienePinActual) {
        const { data: userData } = await supabase
          .from('usuarios')
          .select('pin')
          .eq('id', usuario?.id)
          .single()

        if (userData?.pin !== pinActual) {
          setError('PIN actual incorrecto')
          setSaving(false)
          return
        }
      }

      // Actualizar PIN
      const { error: updateError } = await supabase
        .from('usuarios')
        .update({ pin: pinNuevo })
        .eq('id', usuario?.id)

      if (updateError) throw updateError

      setTienePinActual(true)
      setShowPinModal(false)
      setPinActual('')
      setPinNuevo('')
      setPinConfirmar('')
      mostrarExito('PIN actualizado')

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
      // Actualizar contraseña en Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordNueva
      })

      if (updateError) throw updateError

      setShowPasswordModal(false)
      setPasswordActual('')
      setPasswordNueva('')
      setPasswordConfirmar('')
      mostrarExito('Contraseña actualizada')

    } catch (err) {
      console.error('Error:', err)
      setError('Error al cambiar la contraseña. Verifica tu contraseña actual.')
    } finally {
      setSaving(false)
    }
  }

  // NUEVA FUNCIÓN - AGREGADA
  const guardarCostosFijos = async () => {
    setSaving(true)
    setError('')

    try {
      // Verificar si ya existe registro
      const { data: existente } = await supabase
        .from('costos_fijos')
        .select('id')
        .eq('sucursal_id', usuario?.sucursal_id)
        .single()

      const datosGuardar = {
        sucursal_id: usuario?.sucursal_id,
        alquiler_mensual: costosFijos.alquiler,
        servicios_mensuales: costosFijos.servicios,
        sueldos_mensuales: costosFijos.sueldos,
        otros_gastos_mensuales: costosFijos.otros,
        updated_at: new Date().toISOString()
      }

      if (existente) {
        // Actualizar
        const { error: updateError } = await supabase
          .from('costos_fijos')
          .update(datosGuardar)
          .eq('sucursal_id', usuario?.sucursal_id)

        if (updateError) throw updateError
      } else {
        // Crear
        const { error: insertError } = await supabase
          .from('costos_fijos')
          .insert(datosGuardar)

        if (insertError) throw insertError
      }

      mostrarExito('Costos fijos actualizados')
    } catch (err) {
      console.error('Error:', err)
      setError('Error al guardar los costos fijos')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">⚙️ Configuración</h1>
          <p className="text-sm text-gray-600 mt-1">Personaliza tu perfil y preferencias</p>
        </div>
      </div>

      {/* Mensaje de éxito flotante */}
      {showExito && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-bounce-in">
          <div className="bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">{mensajeExito}</span>
          </div>
        </div>
      )}

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Error global */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Perfil */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Información Personal</h2>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
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
                placeholder="Opcional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">El email no se puede modificar</p>
            </div>

            <button
              onClick={guardarPerfil}
              disabled={saving}
              className="w-full px-4 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 font-medium transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>

        {/* Logo de la Sucursal */}
        {(usuario?.rol === 'admin' || usuario?.rol === 'gerente') && (
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Logo de la Sucursal</h2>
            
            <div className="flex flex-col items-center gap-4">
              {logoUrl ? (
                <div className="relative">
                  <Image
                    src={logoUrl}
                    alt="Logo"
                    width={200}
                    height={200}
                    className="rounded-xl object-contain border border-gray-200"
                  />
                  <button
                    onClick={eliminarLogo}
                    className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="w-48 h-48 bg-gray-100 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-300">
                  <p className="text-gray-400 text-sm">Sin logo</p>
                </div>
              )}

              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={subirLogo}
                  disabled={uploadingLogo}
                  className="hidden"
                />
                <span className="px-6 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors inline-block font-medium">
                  {uploadingLogo ? 'Subiendo...' : logoUrl ? 'Cambiar Logo' : 'Subir Logo'}
                </span>
              </label>
              
              <p className="text-xs text-gray-500 text-center">
                Formato: JPG, PNG • Máx: 2MB<br />
                Recomendado: 500x500 px
              </p>
            </div>
          </div>
        )}

        {/* Costos Fijos del Negocio - NUEVA SECCIÓN AGREGADA */}
        {(usuario?.rol === 'admin' || usuario?.rol === 'gerente') && (
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">💼 Costos Fijos del Negocio</h2>
                <p className="text-sm text-gray-500 mt-1">Configura tus gastos mensuales para el análisis de punto de equilibrio</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alquiler Mensual (Bs.)
                </label>
                <input
                  type="number"
                  value={costosFijos.alquiler}
                  onChange={(e) => setCostosFijos({...costosFijos, alquiler: parseFloat(e.target.value) || 0})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  placeholder="0.00"
                  min="0"
                  step="100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Servicios Mensuales (Bs.)
                </label>
                <input
                  type="number"
                  value={costosFijos.servicios}
                  onChange={(e) => setCostosFijos({...costosFijos, servicios: parseFloat(e.target.value) || 0})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  placeholder="0.00"
                  min="0"
                  step="50"
                />
                <p className="text-xs text-gray-500 mt-1">Luz, agua, internet, teléfono</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sueldos Mensuales (Bs.)
                </label>
                <input
                  type="number"
                  value={costosFijos.sueldos}
                  onChange={(e) => setCostosFijos({...costosFijos, sueldos: parseFloat(e.target.value) || 0})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  placeholder="0.00"
                  min="0"
                  step="500"
                />
                <p className="text-xs text-gray-500 mt-1">Total de salarios del personal</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Otros Gastos Mensuales (Bs.)
                </label>
                <input
                  type="number"
                  value={costosFijos.otros}
                  onChange={(e) => setCostosFijos({...costosFijos, otros: parseFloat(e.target.value) || 0})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  placeholder="0.00"
                  min="0"
                  step="100"
                />
                <p className="text-xs text-gray-500 mt-1">Seguridad, limpieza, mantenimiento</p>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900">Total Costos Fijos Mensuales:</span>
                <span className="text-2xl font-bold text-blue-600">
                  Bs. {(costosFijos.alquiler + costosFijos.servicios + costosFijos.sueldos + costosFijos.otros).toFixed(2)}
                </span>
              </div>
            </div>

            <button
              onClick={guardarCostosFijos}
              disabled={saving}
              className="w-full px-4 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 font-medium transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar Costos Fijos'}
            </button>
          </div>
        )}

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

      </div>

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