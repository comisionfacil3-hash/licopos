'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Empresa } from '@/types/database'

export default function EmpresasPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null)
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    email: '',
    direccion: '',
    activa: true
  })
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  const fetchEmpresas = async () => {
    try {
      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setEmpresas(data || [])
    } catch (error) {
      console.error('Error fetching empresas:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmpresas()
  }, [])

  const handleCreate = () => {
    setEditingEmpresa(null)
    setFormData({
      nombre: '',
      telefono: '',
      email: '',
      direccion: '',
      activa: true
    })
    setShowModal(true)
  }

  const handleEdit = (empresa: Empresa) => {
    setEditingEmpresa(empresa)
    setFormData({
      nombre: empresa.nombre,
      telefono: empresa.telefono || '',
      email: empresa.email || '',
      direccion: empresa.direccion || '',
      activa: empresa.activa
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editingEmpresa) {
        // Actualizar
        const { error } = await supabase
          .from('empresas')
          .update({
            nombre: formData.nombre,
            telefono: formData.telefono,
            email: formData.email,
            direccion: formData.direccion,
            activa: formData.activa
          })
          .eq('id', editingEmpresa.id)

        if (error) throw error
      } else {
        // Crear
        const { error } = await supabase
          .from('empresas')
          .insert({
            nombre: formData.nombre,
            telefono: formData.telefono,
            email: formData.email,
            direccion: formData.direccion,
            activa: formData.activa
          })

        if (error) throw error
      }

      setShowModal(false)
      fetchEmpresas()
    } catch (error) {
      console.error('Error saving empresa:', error)
      alert('Error al guardar empresa')
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (empresa: Empresa) => {
    try {
      const { error } = await supabase
        .from('empresas')
        .update({ activa: !empresa.activa })
        .eq('id', empresa.id)

      if (error) throw error
      fetchEmpresas()
    } catch (error) {
      console.error('Error updating empresa status:', error)
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
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Empresas</h1>
          <p className="text-gray-600">Administra las empresas del sistema</p>
        </div>
        <button onClick={handleCreate} className="btn-primary">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Empresa
        </button>
      </div>

      {/* Lista de Empresas */}
      <div className="space-y-4">
        {empresas.map((empresa) => (
          <div key={empresa.id} className="card card-padding">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center">
                  <h3 className="text-lg font-semibold text-gray-900">{empresa.nombre}</h3>
                  <span className={`ml-3 badge ${empresa.activa ? 'badge-success' : 'badge-error'}`}>
                    {empresa.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
                  <div>📞 {empresa.telefono || 'Sin teléfono'}</div>
                  <div>📧 {empresa.email || 'Sin email'}</div>
                  <div>📍 {empresa.direccion || 'Sin dirección'}</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleEdit(empresa)}
                  className="btn-ghost p-2"
                  title="Editar"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => toggleStatus(empresa)}
                  className={`p-2 rounded-lg ${empresa.activa ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                  title={empresa.activa ? 'Desactivar' : 'Activar'}
                >
                  {empresa.activa ? (
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

        {empresas.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay empresas</h3>
            <p className="mt-1 text-sm text-gray-500">Comienza creando tu primera empresa.</p>
            <button onClick={handleCreate} className="btn-primary mt-4">
              Nueva Empresa
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
                {editingEmpresa ? 'Editar Empresa' : 'Nueva Empresa'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="label">Nombre *</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Nombre de la empresa"
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
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@empresa.com"
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
                    id="activa"
                    checked={formData.activa}
                    onChange={(e) => setFormData({ ...formData, activa: e.target.checked })}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="activa" className="ml-2 text-sm text-gray-600">
                    Empresa activa
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
                  disabled={saving || !formData.nombre}
                >
                  {saving ? (
                    <>
                      <span className="spinner mr-2"></span>
                      Guardando...
                    </>
                  ) : (
                    editingEmpresa ? 'Actualizar' : 'Crear'
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