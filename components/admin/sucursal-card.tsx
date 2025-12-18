'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/format'

interface SucursalCardProps {
  sucursal: {
    id: string
    nombre: string
    direccion: string | null
    activa: boolean
    empresa: {
      nombre: string
    }
  }
  metrics: {
    ventasHoy: number
    productosStockBajo: number
    productosSinStock: number
    usuariosActivos: number
    creditosPendientes: number
    cajaAbierta: boolean
  }
  onToggleEstado: (id: string, nuevoEstado: boolean) => Promise<void>
}

export default function SucursalCard({ sucursal, metrics, onToggleEstado }: SucursalCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    setLoading(true)
    try {
      await onToggleEstado(sucursal.id, !sucursal.activa)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`bg-white rounded-xl border-2 transition-all ${
      sucursal.activa ? 'border-green-200' : 'border-red-200'
    }`}>
      {/* Header */}
      <div 
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900">{sucursal.nombre}</h3>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                sucursal.activa 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {sucursal.activa ? 'Activa' : 'Pausada'}
              </span>
            </div>
            <p className="text-sm text-gray-500">{sucursal.empresa.nombre}</p>
            {sucursal.direccion && (
              <p className="text-xs text-gray-400 mt-1">📍 {sucursal.direccion}</p>
            )}
          </div>

          {/* Toggle expandir */}
          <button className="text-gray-400 hover:text-gray-600">
            <svg 
              className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Métricas rápidas (siempre visible) */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="bg-blue-50 rounded-lg p-2">
            <p className="text-xs text-blue-600 font-medium">Ventas Hoy</p>
            <p className="text-sm font-bold text-blue-900">{formatCurrency(metrics.ventasHoy)}</p>
          </div>
          <div className={`rounded-lg p-2 ${
            metrics.productosSinStock > 0 ? 'bg-red-50' : 'bg-gray-50'
          }`}>
            <p className={`text-xs font-medium ${
              metrics.productosSinStock > 0 ? 'text-red-600' : 'text-gray-600'
            }`}>Sin Stock</p>
            <p className={`text-sm font-bold ${
              metrics.productosSinStock > 0 ? 'text-red-900' : 'text-gray-900'
            }`}>{metrics.productosSinStock}</p>
          </div>
          <div className={`rounded-lg p-2 ${
            metrics.productosStockBajo > 0 ? 'bg-orange-50' : 'bg-gray-50'
          }`}>
            <p className={`text-xs font-medium ${
              metrics.productosStockBajo > 0 ? 'text-orange-600' : 'text-gray-600'
            }`}>Stock Bajo</p>
            <p className={`text-sm font-bold ${
              metrics.productosStockBajo > 0 ? 'text-orange-900' : 'text-gray-900'
            }`}>{metrics.productosStockBajo}</p>
          </div>
        </div>
      </div>

      {/* Detalles expandidos */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-3 animate-bounce-in">
          {/* Métricas detalladas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-purple-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-purple-600 font-medium">👥 Usuarios</span>
                <span className="text-lg font-bold text-purple-900">{metrics.usuariosActivos}</span>
              </div>
              <p className="text-xs text-purple-600">activos</p>
            </div>

            <div className={`rounded-lg p-3 ${
              metrics.creditosPendientes > 0 ? 'bg-yellow-50' : 'bg-gray-50'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-medium ${
                  metrics.creditosPendientes > 0 ? 'text-yellow-600' : 'text-gray-600'
                }`}>💳 Créditos</span>
                <span className={`text-lg font-bold ${
                  metrics.creditosPendientes > 0 ? 'text-yellow-900' : 'text-gray-900'
                }`}>{metrics.creditosPendientes}</span>
              </div>
              <p className={`text-xs ${
                metrics.creditosPendientes > 0 ? 'text-yellow-600' : 'text-gray-600'
              }`}>pendientes</p>
            </div>
          </div>

          {/* Estado de caja */}
          <div className={`rounded-lg p-3 ${
            metrics.cajaAbierta ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                metrics.cajaAbierta ? 'bg-green-500' : 'bg-gray-400'
              }`}></div>
              <span className={`text-sm font-medium ${
                metrics.cajaAbierta ? 'text-green-700' : 'text-gray-600'
              }`}>
                Caja {metrics.cajaAbierta ? 'Abierta' : 'Cerrada'}
              </span>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleToggle}
              disabled={loading}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                sucursal.activa
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Procesando...' : (sucursal.activa ? '⏸️ Pausar' : '▶️ Activar')}
            </button>

            <a
              href={`/admin/sucursales/${sucursal.id}`}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-medium hover:bg-blue-200 transition-colors"
            >
              ⚙️ Gestionar
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
