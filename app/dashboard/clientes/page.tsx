// Path: app\dashboard\clientes\page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { Cliente } from '@/types/database'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    email: '',
    direccion: '',
    nit: '',
    notas: '',
    limite_credito: ''
  })

  const { usuario } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (usuario?.sucursal_id) {
      loadClientes()
    }
  }, [usuario?.sucursal_id])

  const loadClientes = async () => {
    if (!usuario?.sucursal_id) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('activo', true)
        .order('nombre')

      if (error) throw error
      setClientes(data || [])
    } catch (err) {
      console.error('Error cargando clientes:', err)
    } finally {
      setLoading(false)
    }
  }

  const clientesFiltrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.telefono?.includes(searchTerm) ||
    c.nit?.includes(searchTerm)
  )

  const openCreateModal = () => {
    setEditingCliente(null)
    setFormData({
      nombre: '',
      telefono: '',
      email: '',
      direccion: '',
      nit: '',
      notas: '',
      limite_credito: '0'
    })
    setError('')
    setShowModal(true)
  }

  const openEditModal = (cliente: Cliente) => {
    setEditingCliente(cliente)
    setFormData({
      nombre: cliente.nombre,
      telefono: cliente.telefono || '',
      email: cliente.email || '',
      direccion: cliente.direccion || '',
      nit: cliente.nit || '',
      notas: cliente.notas || '',
      limite_credito: cliente.limite_credito?.toString() || '0'
    })
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      setError('El nombre es requerido')
      return
    }

    setSaving(true)
    setError('')

    try {
      if (editingCliente) {
        const { error: updateError } = await supabase
          .from('clientes')
          .update({
            nombre: formData.nombre.trim(),
            telefono: formData.telefono.trim() || null,
            email: formData.email.trim() || null,
            direccion: formData.direccion.trim() || null,
            nit: formData.nit.trim() || null,
            notas: formData.notas.trim() || null,
            limite_credito: parseFloat(formData.limite_credito) || 0
          })
          .eq('id', editingCliente.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('clientes')
          .insert({
            sucursal_id: usuario?.sucursal_id,
            nombre: formData.nombre.trim(),
            telefono: formData.telefono.trim() || null,
            email: formData.email.trim() || null,
            direccion: formData.direccion.trim() || null,
            nit: formData.nit.trim() || null,
            notas: formData.notas.trim() || null,
            limite_credito: parseFloat(formData.limite_credito) || 0
          })

        if (insertError) throw insertError
      }

      setShowModal(false)
      loadClientes()
    } catch (err) {
      console.error('Error guardando cliente:', err)
      setError('Error al guardar el cliente')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (cliente: Cliente) => {
    if (!confirm('Esta seguro de eliminar este cliente?')) return

    try {
      const { error } = await supabase
        .from('clientes')
        .update({ activo: false })
        .eq('id', cliente.id)

      if (error) throw error
      loadClientes()
    } catch (err) {
      console.error('Error eliminando cliente:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando clientes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 text-sm">{clientes.length} clientes registrados</p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium"
        >
          + Nuevo Cliente
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre, telefono o NIT..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
        />
      </div>

      {clientesFiltrados.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No hay clientes</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm ? 'No se encontraron clientes' : 'Comienza agregando tu primer cliente'}
          </p>
          {!searchTerm && (
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
            >
              + Agregar Cliente
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {clientesFiltrados.map(cliente => (
            <div
              key={cliente.id}
              className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{cliente.nombre}</h3>
                  {cliente.telefono && (
                    <p className="text-gray-500 text-sm">{cliente.telefono}</p>
                  )}
                  {cliente.nit && (
                    <p className="text-gray-400 text-xs">NIT: {cliente.nit}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(cliente)}
                    className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(cliente)}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                {editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
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
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Nombre del cliente"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                <input
                  type="tel"
                  value={formData.telefono}
                  onChange={e => setFormData(prev => ({ ...prev, telefono: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Numero de telefono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="correo@ejemplo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NIT</label>
                <input
                  type="text"
                  value={formData.nit}
                  onChange={e => setFormData(prev => ({ ...prev, nit: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Numero de NIT"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Direccion</label>
                <input
                  type="text"
                  value={formData.direccion}
                  onChange={e => setFormData(prev => ({ ...prev, direccion: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Direccion del cliente"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Limite de credito (Bs.)</label>
                <input
                  type="number"
                  value={formData.limite_credito}
                  onChange={e => setFormData(prev => ({ ...prev, limite_credito: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={formData.notas}
                  onChange={e => setFormData(prev => ({ ...prev, notas: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                  rows={2}
                  placeholder="Notas adicionales"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={openCreateModal}
        className="fixed bottom-24 right-4 w-14 h-14 bg-emerald-500 text-white rounded-full shadow-lg hover:bg-emerald-600 flex items-center justify-center sm:hidden"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  )
}