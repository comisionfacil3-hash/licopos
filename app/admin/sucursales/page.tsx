'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Sucursal, Empresa } from '@/types/database'

interface SucursalWithEmpresa extends Sucursal {
  empresa: Empresa
}

export default function SucursalesPage() {
  const [sucursales, setSucursales] = useState<SucursalWithEmpresa[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingSucursal, setEditingSucursal] = useState<SucursalWithEmpresa | null>(null)
  const [formData, setFormData] = useState({
    empresa_id: '',
    nombre: '',
    direccion: '',
    telefono: '',
    activa: true
  })
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  const fetchSucursales = async () => {
    try {
      const { data, error } = await supabase
        .from('sucursales')
        .select(`
          *,
          empresa:empresas(*)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setSucursales(data || [])
    } catch (error) {
      console.error('Error fetching sucursales:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEmpresas = async () => {
    try {
      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .eq('activa', true)
        .order('nombre')

      if (error) throw error
      setEmpresas(data || [])
    } catch (error) {
      console.error('Error fetching empresas:', error)
    }
  }

  useEffect(() => {
    fetchSucursales()
    fetchEmpresas()
  }, [])

  const handleCreate = () => {
    setEditingSucursal(null)
    setFormData({
      empresa_id: '',
      nombre: '',
      direccion: '',
      telefono: '',
      activa: true
    })
    setShowModal(true)
  }

  const handleEdit = (sucursal: SucursalWithEmpresa) => {
    setEditingSucursal(sucursal)
    setFormData({
      empresa_id: sucursal.empresa_id,
      nombre: sucursal.nombre,
      direccion: sucursal.direccion || '',
      telefono: sucursal.telefono || '',
      activa: sucursal.activa
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editingSucursal) {
        // Actualizar
        const { error } = await supabase
          .from('sucursales')
          .update({
            empresa_id: formData.empresa_id,
            nombre: formData.nombre,
            direccion: formData.direccion,
            telefono: formData.telefono,
            activa: formData.activa
          })
          .eq('id', editingSucursal.id)

        if (error) throw error
      } else {
        // Crear
        const { error } = await supabase
          .from('sucursales')
          .insert({
            empresa_id: formData.empresa_id,
            nombre: formData.nombre,
            direccion: formData.direccion,
            telefono: formData.telefono,
            activa: formData.activa
          })

        if (error) throw error
      }

      setShowModal(false)
      fetchSucursales()
    } catch (error) {
      console.error('Error saving sucursal:', error)
      alert('Error al guardar sucursal')
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (sucursal: SucursalWithEmpresa) => {
    try {
      const { error } = await supabase
        .from('sucursales')
        .update({ activa: !sucursal.activa })
        .eq('id', sucursal.id)

      if (error) throw error
      fetchSucursales()
    } catch (error) {
      console.error('Error updating sucursal status:', error)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Sucursales</h1>
          <p className="text-gray-600">Administra las sucursales de cada empresa</p>
        </div>
        <button onClick={handleCreate} className="btn-primary">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Sucursal
        </button>
      </div>

      {/* Lista de Sucursales */}
      <div className="space-y-4">
        {sucursales.map((sucursal) => (
          <div key={sucursal.id} className="card card-padding">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center">
                  <h3 className="text-lg font-semibold text-gray-900">{sucursal.nombre}</h3>
                  <span className={`ml-3 badge ${sucursal.activa ? 'badge-success' : 'badge-error'}`}>
                    {sucursal.activa ? 'Activa' : 'Inactiva'}
                  </span>
                  <span className="ml-2 badge badge-info">
                    {sucursal.empresa.nombre}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                  <div>📞 {sucursal.telefono || 'Sin teléfono'}</div>
                  <div>📍 {sucursal.direccion || 'Sin dirección'}</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleEdit(sucursal)}
                  className="btn-ghost p-2"
                  title="Editar"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => toggleStatus(sucursal)}
                  className={`p-2 rounded-lg ${sucursal.activa ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                  title={sucursal.activa ? 'Desactivar' : 'Activar'}
                >
                  {sucursal.activa ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18 12m-5 5l-5-5" />
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

        {sucursales.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay sucursales</h3>
            <p className="mt-1 text-sm text-gray-500">Comienza creando tu primera sucursal.</p>
            <button onClick={handleCreate} className="btn-primary mt-4">
              Nueva Sucursal
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {editingSucursal ? 'Editar Sucursal' : 'Nueva Sucursal'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="label">Empresa *</label>
                  <select
                    className="input"
                    value={formData.empresa_id}
                    onChange={(e) => setFormData({ ...formData, empresa_id: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar empresa</option>
                    {empresas.map((empresa) => (
                      <option key={empresa.id} value={empresa.id}>
                        {empresa.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Nombre *</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Nombre de la sucursal"
                    required
                  />
                </div>

                <div>
                  <label className="label">Teléfono</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    placeholder="Teléfono de contacto"
                  />
                </div>

                <div>
                  <label className="label">Dirección</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={formData.direccion}
                    onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                    placeholder="Dirección completa"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="activa-sucursal"
                    checked={formData.activa}
                    onChange={(e) => setFormData({ ...formData, activa: e.target.checked })}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="activa-sucursal" className="ml-2 text-sm text-gray-600">
                    Sucursal activa
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  className="btn-primary"
                  disabled={saving || !formData.nombre || !formData.empresa_id}
                >
                  {saving ? (
                    <>
                      <span className="spinner mr-2"></span>
                      Guardando...
                    </>
                  ) : (
                    editingSucursal ? 'Actualizar' : 'Crear'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}