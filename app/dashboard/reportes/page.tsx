'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'
import { useRouter } from 'next/navigation'

type Tab = 'ventas' | 'operativos' | 'financieros'

interface ReporteCard {
  id: string
  titulo: string
  descripcion: string
  emoji: string
  ruta: string
  categoria: Tab
  rolesPermitidos: string[]
}

export default function ReportesPage() {
  const { usuario, loading: authLoading } = useAuth()
  const router = useRouter()
  const [tabActiva, setTabActiva] = useState<Tab>('ventas')

  // Lista completa de reportes
  const reportes: ReporteCard[] = [
    // REPORTES DE VENTAS (todos los roles)
    {
      id: 'mas-vendidos',
      titulo: 'Productos Más/Menos Vendidos',
      descripcion: 'Ranking de productos por volumen de ventas',
      emoji: '📊',
      ruta: '/dashboard/reportes/ventas/mas-vendidos',
      categoria: 'ventas',
      rolesPermitidos: ['admin', 'gerente', 'vendedor']
    },
    {
      id: 'tendencias',
      titulo: 'Tendencias de Ventas',
      descripcion: 'Patrones de venta por temporada y período',
      emoji: '📈',
      ruta: '/dashboard/reportes/ventas/tendencias',
      categoria: 'ventas',
      rolesPermitidos: ['admin', 'gerente', 'vendedor']
    },
    {
      id: 'pronostico',
      titulo: 'Pronóstico de Demanda',
      descripcion: 'Proyección de necesidades futuras de inventario',
      emoji: '🔮',
      ruta: '/dashboard/reportes/ventas/pronostico',
      categoria: 'ventas',
      rolesPermitidos: ['admin', 'gerente', 'vendedor']
    },

    // REPORTES OPERATIVOS (admin y gerente)
    {
      id: 'stock-alertas',
      titulo: 'Stock Mínimo y Máximo',
      descripcion: 'Alertas de productos con stock bajo o excesivo',
      emoji: '📦',
      ruta: '/dashboard/reportes/operativos/stock-alertas',
      categoria: 'operativos',
      rolesPermitidos: ['admin', 'gerente']
    },
    {
      id: 'lento-movimiento',
      titulo: 'Productos de Lento Movimiento',
      descripcion: 'Artículos sin ventas en período prolongado',
      emoji: '🐌',
      ruta: '/dashboard/reportes/operativos/lento-movimiento',
      categoria: 'operativos',
      rolesPermitidos: ['admin', 'gerente']
    },

    // REPORTES FINANCIEROS (solo admin y gerente)
    {
      id: 'punto-equilibrio',
      titulo: 'Punto de Equilibrio',
      descripcion: 'Unidades necesarias para cubrir costos',
      emoji: '⚖️',
      ruta: '/dashboard/reportes/financieros/punto-equilibrio',
      categoria: 'financieros',
      rolesPermitidos: ['admin', 'gerente']
    },
    {
      id: 'margen-contribucion',
      titulo: 'Margen de Contribución',
      descripcion: 'Aporte de cada producto a costos fijos',
      emoji: '💰',
      ruta: '/dashboard/reportes/financieros/margen-contribucion',
      categoria: 'financieros',
      rolesPermitidos: ['admin', 'gerente']
    },
    {
      id: 'valoracion-inventario',
      titulo: 'Valoración de Inventario',
      descripcion: 'Valor total del inventario actual',
      emoji: '💎',
      ruta: '/dashboard/reportes/financieros/valoracion-inventario',
      categoria: 'financieros',
      rolesPermitidos: ['admin', 'gerente']
    },
    {
      id: 'rentabilidad',
      titulo: 'Rentabilidad por Producto',
      descripcion: 'Ganancias netas por producto y categoría',
      emoji: '💵',
      ruta: '/dashboard/reportes/financieros/rentabilidad',
      categoria: 'financieros',
      rolesPermitidos: ['admin', 'gerente']
    }
  ]

  // Filtrar reportes según rol del usuario
  const reportesFiltrados = reportes.filter(reporte => 
    usuario?.rol && reporte.rolesPermitidos.includes(usuario.rol)
  )

  const reportesPorCategoria = reportesFiltrados.filter(
    reporte => reporte.categoria === tabActiva
  )

  // Verificar que vendedor no pueda ver operativos/financieros
  useEffect(() => {
    if (usuario?.rol === 'vendedor' && (tabActiva === 'operativos' || tabActiva === 'financieros')) {
      setTabActiva('ventas')
    }
  }, [usuario, tabActiva])

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  if (!usuario) {
    router.push('/login')
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-8">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">📊 Reportes</h1>
          <p className="text-sm text-gray-600 mt-1">
            Análisis y estadísticas de tu negocio
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-4 overflow-x-auto">
          {/* Tab Ventas - Todos pueden ver */}
          <button
            onClick={() => setTabActiva('ventas')}
            className={`
              px-4 py-2 font-medium text-sm whitespace-nowrap transition-colors
              border-b-2 
              ${tabActiva === 'ventas'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
              }
            `}
          >
            📈 Ventas
            <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              {reportes.filter(r => r.categoria === 'ventas' && r.rolesPermitidos.includes(usuario.rol)).length}
            </span>
          </button>

          {/* Tab Operativos - Solo admin y gerente */}
          {usuario.rol !== 'vendedor' && (
            <button
              onClick={() => setTabActiva('operativos')}
              className={`
                px-4 py-2 font-medium text-sm whitespace-nowrap transition-colors
                border-b-2 
                ${tabActiva === 'operativos'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
                }
              `}
            >
              📦 Operativos
              <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {reportes.filter(r => r.categoria === 'operativos').length}
              </span>
            </button>
          )}

          {/* Tab Financieros - Solo admin y gerente */}
          {usuario.rol !== 'vendedor' && (
            <button
              onClick={() => setTabActiva('financieros')}
              className={`
                px-4 py-2 font-medium text-sm whitespace-nowrap transition-colors
                border-b-2 
                ${tabActiva === 'financieros'
                  ? 'border-amber-600 text-amber-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
                }
              `}
            >
              💰 Financieros
              <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {reportes.filter(r => r.categoria === 'financieros').length}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4 max-w-7xl mx-auto">
        {/* Info del rol */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">👤 Nivel de acceso:</span>{' '}
            {usuario.rol === 'admin' && 'Administrador - Acceso completo a todos los reportes'}
            {usuario.rol === 'gerente' && 'Gerente - Acceso a reportes operativos y financieros'}
            {usuario.rol === 'vendedor' && 'Vendedor - Acceso solo a reportes de ventas'}
          </p>
        </div>

        {/* Grid de reportes */}
        {reportesPorCategoria.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportesPorCategoria.map((reporte) => {
              return (
                <button
                  key={reporte.id}
                  onClick={() => router.push(reporte.ruta)}
                  className="bg-white p-6 rounded-xl border border-gray-200 hover:border-emerald-500 
                           hover:shadow-lg transition-all text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className={`
                      text-4xl
                      group-hover:scale-110 transition-transform
                    `}>
                      {reporte.emoji}
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
                        {reporte.titulo}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {reporte.descripcion}
                      </p>
                    </div>
                  </div>

                  {/* Indicador "Próximamente" para reportes no creados aún */}
                  {reporte.id !== 'mas-vendidos' && (
                    <div className="mt-4 inline-block">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                        🚧 Próximamente
                      </span>
                    </div>
                  )}

                  {/* Indicador "Disponible" para reporte ya creado */}
                  {reporte.id === 'mas-vendidos' && (
                    <div className="mt-4 inline-block">
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                        ✅ Disponible
                      </span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📦</div>
            <p className="text-gray-600">No hay reportes disponibles para esta categoría</p>
          </div>
        )}

        {/* Info adicional */}
        <div className="mt-8 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <h3 className="font-semibold text-emerald-900 mb-2">💡 Tip:</h3>
          <p className="text-sm text-emerald-800">
            Todos los reportes incluyen <strong>exportación a Excel</strong> para que puedas 
            trabajar con los datos en tu computadora. Los filtros de fecha te permiten analizar 
            períodos específicos.
          </p>
        </div>
      </div>
    </div>
  )
}