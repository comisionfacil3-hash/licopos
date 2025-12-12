'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/format'

interface Stats {
  totalEmpresas: number
  totalSucursales: number
  totalUsuarios: number
  empresasActivas: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalEmpresas: 0,
    totalSucursales: 0,
    totalUsuarios: 0,
    empresasActivas: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      const supabase = createClient()
      
      try {
        // Obtener estadísticas
        const [empresas, sucursales, usuarios] = await Promise.all([
          supabase.from('empresas').select('id, activa'),
          supabase.from('sucursales').select('id'),
          supabase.from('usuarios').select('id, activo')
        ])

        setStats({
          totalEmpresas: empresas.data?.length || 0,
          totalSucursales: sucursales.data?.length || 0,
          totalUsuarios: usuarios.data?.length || 0,
          empresasActivas: empresas.data?.filter(e => e.activa).length || 0
        })
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const statCards = [
    {
      title: 'Total Empresas',
      value: stats.totalEmpresas,
      subtitle: `${stats.empresasActivas} activas`,
      icon: (
        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Total Sucursales',
      value: stats.totalSucursales,
      subtitle: 'En todas las empresas',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      bgColor: 'bg-green-100'
    },
    {
      title: 'Total Usuarios',
      value: stats.totalUsuarios,
      subtitle: 'En el sistema',
      icon: (
        <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
      bgColor: 'bg-purple-100'
    },
    {
      title: 'Sistema',
      value: '100%',
      subtitle: 'Operativo',
      icon: (
        <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bgColor: 'bg-emerald-100'
    }
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Panel de Administración</h1>
        <p className="text-gray-600 mt-2">Gestión completa del sistema LicoPos</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat, index) => (
          <div key={index} className="card card-padding">
            <div className="flex items-center">
              <div className={`${stat.bgColor} rounded-lg p-3`}>
                {stat.icon}
              </div>
              <div className="ml-4">
                <h3 className="text-2xl font-bold text-gray-900">
                  {loading ? (
                    <div className="w-8 h-6 bg-gray-200 rounded animate-pulse"></div>
                  ) : (
                    stat.value
                  )}
                </h3>
                <p className="text-sm text-gray-600">{stat.title}</p>
                <p className="text-xs text-gray-500">{stat.subtitle}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Empresas */}
        <div className="card card-padding">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Gestión de Empresas</h3>
          <p className="text-gray-600 mb-4">Administra las empresas del sistema y sus configuraciones.</p>
          <a href="/admin/empresas" className="btn-primary">
            Gestionar Empresas
          </a>
        </div>

        {/* Sucursales */}
        <div className="card card-padding">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Gestión de Sucursales</h3>
          <p className="text-gray-600 mb-4">Configura y administra las sucursales de cada empresa.</p>
          <a href="/admin/sucursales" className="btn-primary">
            Gestionar Sucursales
          </a>
        </div>

        {/* Usuarios */}
        <div className="card card-padding">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Gestión de Usuarios</h3>
          <p className="text-gray-600 mb-4">Crea y administra usuarios del sistema con sus permisos.</p>
          <a href="/admin/usuarios" className="btn-primary">
            Gestionar Usuarios
          </a>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card card-padding">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Actividad Reciente</h3>
        <div className="space-y-3">
          <div className="flex items-center p-3 bg-gray-50 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="ml-3 text-sm text-gray-600">Sistema iniciado correctamente</span>
            <span className="ml-auto text-xs text-gray-500">Hace unos momentos</span>
          </div>
          <div className="flex items-center p-3 bg-gray-50 rounded-lg">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="ml-3 text-sm text-gray-600">Base de datos conectada</span>
            <span className="ml-auto text-xs text-gray-500">Hace unos momentos</span>
          </div>
          <div className="flex items-center p-3 bg-gray-50 rounded-lg">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <span className="ml-3 text-sm text-gray-600">Esperando configuración inicial</span>
            <span className="ml-auto text-xs text-gray-500">Ahora</span>
          </div>
        </div>
      </div>
    </div>
  )
}