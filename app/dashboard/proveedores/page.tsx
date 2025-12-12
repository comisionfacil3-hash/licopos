'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { formatDateTime } from '@/lib/utils/timezone'
import * as XLSX from 'xlsx'

interface Proveedor {
  id: string
  nombre: string
  contacto: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  nit: string | null
  notas: string | null
  activo: boolean
  created_at: string
}

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Proveedor | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  
  // Campos del formulario
  const [nombre, setNombre] = useState('')
  const [contacto, setContacto] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [direccion, setDireccion] = useState('')
  const [nit, setNit] = useState('')
  const [notas, setNotas] = useState('')

  const { usuario } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (usuario?.sucursal_id) {
      loadProveedores()
    }
  }, [usuario?.sucursal_id])

  const loadProveedores = async () => {
    if (!usuario?.sucursal_id) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('proveedores')
        .select('*')
        .eq('sucursal_id', usuario.sucursal_id)
        .order('nombre')

      if (error) throw error
      setProveedores(data || [])
    } catch (err) {
      console.error('Error cargando proveedores:', err)
    } finally {
      setLoading(false)
    }
  }

  // Filtrar proveedores
  const proveedoresFiltrados = proveedores.filter(p => 
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.contacto && p.contacto.toLowerCase().includes(busqueda.toLowerCase())) ||
    (p.telefono && p.telefono.includes(busqueda))
  )

  // Abrir modal para nuevo
  const abrirNuevo = () => {
    setEditando(null)
    setNombre('')
    setContacto('')
    setTelefono('')
    setEmail('')
    setDireccion('')
    setNit('')
    setNotas('')
    setError('')
    setShowModal(true)
  }

  // Abrir modal para editar
  const abrirEditar = (prov: Proveedor) => {
    setEditando(prov)
    setNombre(prov.nombre)
    setContacto(prov.contacto || '')
    setTelefono(prov.telefono || '')
    setEmail(prov.email || '')
    setDireccion(prov.direccion || '')
    setNit(prov.nit || '')
    setNotas(prov.notas || '')
    setError('')
    setShowModal(true)
  }

  // Guardar proveedor
  const guardarProveedor = async () => {
    if (!usuario?.sucursal_id) return

    if (!nombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }

    setGuardando(true)
    setError('')

    try {
      const datos = {
        sucursal_id: usuario.sucursal_id,
        nombre: nombre.trim(),
        contacto: contacto.trim() || null,
        telefono: telefono.trim() || null,
        email: email.trim() || null,
        direccion: direccion.trim() || null,
        nit: nit.trim() || null,
        notas: notas.trim() || null
      }

      if (editando) {
        const { error: updateError } = await supabase
          .from('proveedores')
          .update(datos)
          .eq('id', editando.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('proveedores')
          .insert(datos)

        if (insertError) throw insertError
      }

      setShowModal(false)
      loadProveedores()
    } catch (err: any) {
      console.error('Error guardando proveedor:', err)
      setError(err.message || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  // Toggle activo
  const toggleActivo = async (prov: Proveedor) => {
    try {
      const { error } = await supabase
        .from('proveedores')
        .update({ activo: !prov.activo })
        .eq('id', prov.id)

      if (error) throw error
      loadProveedores()
    } catch (err) {
      console.error('Error actualizando estado:', err)
    }
  }

  // Exportar a Excel
  const exportarExcel = () => {
    if (proveedoresFiltrados.length === 0) return

    const datosExcel = proveedoresFiltrados.map(prov => ({
      'Nombre': prov.nombre,
      'Contacto': prov.contacto || '',
      'Teléfono': prov.telefono || '',
      'Email': prov.email || '',
      'NIT': prov.nit || '',
      'Dirección': prov.direccion || '',
      'Estado': prov.activo ? 'Activo' : 'Inactivo',
      'Notas': prov.notas || '',
      'Fecha Registro': formatDateTime(prov.created_at)
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(datosExcel)
    
    // Ajustar anchos de columna
    ws['!cols'] = [
      { wch: 30 }, // Nombre
      { wch: 25 }, // Contacto
      { wch: 15 }, // Teléfono
      { wch: 30 }, // Email
      { wch: 15 }, // NIT
      { wch: 35 }, // Dirección
      { wch: 10 }, // Estado
      { wch: 30 }, // Notas
      { wch: 18 }, // Fecha Registro
    ]
    
    XLSX.utils.book_append_sheet(wb, ws, 'Proveedores')
    XLSX.writeFile(wb, 'Proveedores.xlsx')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando proveedores...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
          <p className="text-gray-500 text-sm">{proveedores.length} proveedores registrados</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportarExcel}
            disabled={proveedoresFiltrados.length === 0}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            title="Exportar a Excel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <button
            onClick={abrirNuevo}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium flex items-center gap-2 justify-center"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Proveedor
          </button>
        </div>
      </div>

      {/* Buscador */}
      <div className="mb-6">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, contacto o teléfono..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Lista de proveedores */}
      {proveedoresFiltrados.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            {busqueda ? 'Sin resultados' : 'No hay proveedores'}
          </h3>
          <p className="text-gray-500">
            {busqueda ? 'Intenta con otra búsqueda' : 'Agrega tu primer proveedor'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {proveedoresFiltrados.map(prov => (
            <div
              key={prov.id}
              className={`bg-white rounded-xl border p-4 ${
                prov.activo ? 'border-gray-100' : 'border-red-100 bg-red-50/30'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    prov.activo ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{prov.nombre}</h3>
                      {!prov.activo && (
                        <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                          Inactivo
                        </span>
                      )}
                    </div>
                    {prov.contacto && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {prov.contacto}
                      </p>
                    )}
                    {prov.telefono && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {prov.telefono}
                      </p>
                    )}
                    {prov.email && (
                      <p className="text-sm text-gray-400 truncate flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {prov.email}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => abrirEditar(prov)}
                    className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                    title="Editar"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => toggleActivo(prov)}
                    className={`p-2 rounded-lg ${
                      prov.activo
                        ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                        : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                    }`}
                    title={prov.activo ? 'Desactivar' : 'Activar'}
                  >
                    {prov.activo ? (
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
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editando ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la empresa *
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: Distribuidora Central"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Persona de contacto
                </label>
                <input
                  type="text"
                  value={contacto}
                  onChange={e => setContacto(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={telefono}
                    onChange={e => setTelefono(e.target.value)}
                    placeholder="Ej: 70012345"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    NIT
                  </label>
                  <input
                    type="text"
                    value={nit}
                    onChange={e => setNit(e.target.value)}
                    placeholder="Ej: 1234567"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Ej: contacto@proveedor.com"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  value={direccion}
                  onChange={e => setDireccion(e.target.value)}
                  placeholder="Ej: Av. Principal #123"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <textarea
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  placeholder="Observaciones sobre el proveedor..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl resize-none"
                  rows={2}
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={guardarProveedor}
                disabled={guardando || !nombre.trim()}
                className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-xl font-medium disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}