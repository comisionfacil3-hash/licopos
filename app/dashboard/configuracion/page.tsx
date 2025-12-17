'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'

interface SucursalConfig {
  id: string
  nombre: string
  direccion: string | null
  telefono: string | null
  logo_url: string | null
  empresa_id: string
  pin_seguridad: string | null
}
interface EmpresaInfo {
  id: string
  nombre: string
}

export default function ConfiguracionPage() {
  const [sucursal, setSucursal] = useState<SucursalConfig | null>(null)
  const [empresa, setEmpresa] = useState<EmpresaInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Formulario
  const [formData, setFormData] = useState({
    nombre: '',
    direccion: '',
    telefono: '',
    pin: '',
  })

  // Imagen
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  // Solo gerentes y admins pueden configurar
  const puedeConfigurar = usuario?.rol === 'admin' || usuario?.rol === 'gerente'

  useEffect(() => {
    if (usuario?.sucursal_id) {
      fetchSucursal()
    }
  }, [usuario?.sucursal_id])

  const fetchSucursal = async () => {
    try {
      setLoading(true)

      // Obtener sucursal
      const { data: sucursalData, error: sucursalError } = await supabase
        .from('sucursales')
        .select('*')
        .eq('id', usuario?.sucursal_id)
        .single()

      if (sucursalError) throw sucursalError

      setSucursal(sucursalData)
      setFormData({
        nombre: sucursalData.nombre || '',
        direccion: sucursalData.direccion || '',
        telefono: sucursalData.telefono || '',
        pin: '',
      })

      if (sucursalData.logo_url) {
        setLogoPreview(sucursalData.logo_url)
      }

      // Obtener empresa
      const { data: empresaData } = await supabase
        .from('empresas')
        .select('id, nombre')
        .eq('id', sucursalData.empresa_id)
        .single()

      if (empresaData) {
        setEmpresa(empresaData)
      }

    } catch (error) {
      console.error('Error fetching sucursal:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      // Comprimir imagen
      const { compressImage } = await import('@/lib/utils/image-compressor')
      const compressedFile = await compressImage(file, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.8
      })

      setLogoFile(compressedFile)

      // Preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(compressedFile)
    } catch (error) {
      console.error('Error compressing image:', error)
      // Usar original si falla compresión
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !usuario?.sucursal_id) return null

    try {
      setUploading(true)

      const fileExt = logoFile.name.split('.').pop()
      const fileName = `logo-${Date.now()}.${fileExt}`
      const filePath = `sucursales/${usuario.sucursal_id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, logoFile)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('Error uploading logo:', error)
      return null
    } finally {
      setUploading(false)
    }
  }

  const removeLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.nombre.trim()) {
      alert('El nombre de la sucursal es obligatorio')
      return
    }

    setSaving(true)

    try {
      // Subir logo si hay uno nuevo
      let logoUrl = sucursal?.logo_url
      if (logoFile) {
        const newLogoUrl = await uploadLogo()
        if (newLogoUrl) {
          logoUrl = newLogoUrl
        }
      } else if (!logoPreview && sucursal?.logo_url) {
        // Se eliminó el logo
        logoUrl = null
      }

      // Preparar datos de actualización
      const updateData: any = {
        nombre: formData.nombre.trim(),
        direccion: formData.direccion.trim() || null,
        telefono: formData.telefono.trim() || null,
        logo_url: logoUrl,
      }

      // Solo actualizar PIN si se ingresó uno nuevo
      if (formData.pin && formData.pin.length >= 4) {
        updateData.pin_seguridad = formData.pin
      }

      // Actualizar sucursal
      const { error } = await supabase
        .from('sucursales')
        .update(updateData)
        .eq('id', usuario?.sucursal_id)

      if (error) throw error

      alert('Configuración guardada exitosamente')
      await fetchSucursal()

    } catch (error) {
      console.error('Error saving config:', error)
      alert('Error al guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  if (!puedeConfigurar) {
    return (
      <div className="p-4 pb-24">
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Acceso Restringido</h3>
          <p className="mt-1 text-sm text-gray-500">
            No tienes permisos para modificar la configuración
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
          <div className="h-32 bg-gray-200 rounded-xl"></div>
          <div className="h-48 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-600">Personaliza la información de tu sucursal</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Info de empresa (solo lectura) */}
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Empresa</p>
              <p className="font-medium text-gray-900">{empresa?.nombre || 'Sin asignar'}</p>
            </div>
          </div>
        </div>

        {/* Logo de sucursal */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Logo de Sucursal</h3>
          <p className="text-sm text-gray-500 mb-4">
            Este logo aparecerá en las cotizaciones y recibos
          </p>

          <div className="flex items-center space-x-6">
            {/* Preview del logo */}
            <div className="w-32 h-32 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-300">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Logo"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center">
                  <svg className="mx-auto w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs text-gray-500 mt-1">Sin logo</p>
                </div>
              )}
            </div>

            {/* Botones */}
            <div className="flex flex-col space-y-2">
              <label className="btn-primary cursor-pointer text-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Subir Logo
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
              </label>

              {logoPreview && (
                <button
                  type="button"
                  onClick={removeLogo}
                  className="btn-secondary text-red-600 hover:bg-red-50"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Eliminar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Información de la sucursal */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Información de Sucursal</h3>

          <div className="space-y-4">
            <div>
              <label className="label">Nombre de Sucursal *</label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className="input"
                placeholder="Ej: Sucursal Centro"
                required
              />
            </div>

            <div>
              <label className="label">Dirección</label>
              <textarea
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                className="input"
                rows={2}
                placeholder="Ej: Av. Principal #123, Zona Centro"
              />
            </div>

            <div>
              <label className="label">Teléfono</label>
              <input
                type="tel"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                className="input"
                placeholder="Ej: 591 12345678"
              />
            </div>
          </div>
        </div>

        {/* PIN de Seguridad */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">PIN de Seguridad</h3>
          <p className="text-sm text-gray-500 mb-4">
            Este PIN se solicitará al modificar el stock de productos
          </p>

          <div className="space-y-4">
            <div>
              <label className="label">PIN Actual</label>
              <div className="flex items-center space-x-3">
                <input
                  type="password"
                  value={sucursal?.pin_seguridad ? '••••••' : ''}
                  className="input flex-1"
                  placeholder="No configurado"
                  disabled
                />
                <span className={`text-sm font-medium ${sucursal?.pin_seguridad ? 'text-green-600' : 'text-orange-600'}`}>
                  {sucursal?.pin_seguridad ? '✓ Configurado' : '⚠ Sin PIN'}
                </span>
              </div>
            </div>

            <div>
              <label className="label">Nuevo PIN (4-6 dígitos)</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={formData.pin || ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setFormData({ ...formData, pin: value })
                }}
                className="input"
                placeholder="Ingresa nuevo PIN"
              />
              <p className="text-xs text-gray-500 mt-1">
                Deja vacío para mantener el PIN actual
              </p>
            </div>
          </div>
        </div>

        {/* Vista previa de cotización */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Vista Previa (Cotización)</h3>
          
          <div className="bg-gray-50 rounded-lg p-4 border">
            <div className="flex items-center space-x-4 mb-4 pb-4 border-b border-gray-200">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="w-16 h-16 object-contain" />
              ) : (
                <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                  <span className="text-gray-400 text-xs">Logo</span>
                </div>
              )}
              <div>
                <h4 className="font-bold text-gray-900">{formData.nombre || 'Nombre Sucursal'}</h4>
                {formData.direccion && (
                  <p className="text-sm text-gray-600">{formData.direccion}</p>
                )}
                {formData.telefono && (
                  <p className="text-sm text-gray-600">Tel: {formData.telefono}</p>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-400 text-center">
              Así se verá el encabezado en tus cotizaciones
            </p>
          </div>
        </div>

        {/* Botón guardar */}
        <button
          type="submit"
          className="btn-primary w-full py-3"
          disabled={saving || uploading}
        >
          {saving || uploading ? (
            <>
              <span className="spinner mr-2"></span>
              {uploading ? 'Subiendo logo...' : 'Guardando...'}
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Guardar Configuración
            </>
          )}
        </button>
      </form>
    </div>
  )
}