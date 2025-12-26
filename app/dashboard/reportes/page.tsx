// Path: app\dashboard\reportes\page.tsx
'use client'

import { useAuth } from '@/lib/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { 
  TrendingUp, 
  BarChart3, 
  Package, 
  Clock,
  DollarSign,
  PieChart,
  Target,
  Activity
} from 'lucide-react'

export default function ReportesPage() {
  const { usuario, loading } = useAuth()
  const router = useRouter()

  if (loading) {
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

  // Control de acceso por rol
  const puedeVerOperativos = usuario.rol === 'admin' || usuario.rol === 'gerente'
  const puedeVerFinancieros = usuario.rol === 'admin' || usuario.rol === 'gerente'

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">📊 Reportes e Inteligencia</h1>
          <p className="text-sm text-gray-600 mt-1">Análisis avanzado para decisiones estratégicas</p>
        </div>
      </div>

      <div className="p-4 max-w-6xl mx-auto space-y-6">
        {/* Reportes de Ventas */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-gray-900">Reportes de Ventas</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Disponibles para: <strong>Todos los usuarios</strong>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Más Vendidos */}
            <button
              onClick={() => router.push('/dashboard/reportes/ventas/mas-vendidos')}
              className="bg-white rounded-xl p-5 border border-gray-200 hover:border-emerald-500 hover:shadow-lg transition-all text-left group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-500 transition-colors">
                  <BarChart3 className="w-6 h-6 text-emerald-600 group-hover:text-white" />
                </div>
                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                  Activo
                </span>
              </div>
              <h3 className="font-bold text-gray-900 mb-1">Productos Más/Menos Vendidos</h3>
              <p className="text-sm text-gray-600">
                Ranking de productos por cantidad vendida con gráficas
              </p>
            </button>

            {/* Tendencias */}
            <button
              onClick={() => router.push('/dashboard/reportes/ventas/tendencias')}
              className="bg-white rounded-xl p-5 border border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all text-left group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                  <Activity className="w-6 h-6 text-blue-600 group-hover:text-white" />
                </div>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                  Activo
                </span>
              </div>
              <h3 className="font-bold text-gray-900 mb-1">Tendencias de Ventas</h3>
              <p className="text-sm text-gray-600">
                Análisis temporal: horas, días, semanas y meses
              </p>
            </button>

            {/* Pronóstico */}
            <button
              onClick={() => router.push('/dashboard/reportes/ventas/pronostico')}
              className="bg-white rounded-xl p-5 border border-gray-200 hover:border-purple-500 hover:shadow-lg transition-all text-left group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-500 transition-colors">
                  <TrendingUp className="w-6 h-6 text-purple-600 group-hover:text-white" />
                </div>
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                  Activo
                </span>
              </div>
              <h3 className="font-bold text-gray-900 mb-1">Pronóstico de Demanda</h3>
              <p className="text-sm text-gray-600">
                Predicción de ventas y recomendaciones de compra
              </p>
            </button>
          </div>
        </div>

        {/* Reportes Operativos */}
        {puedeVerOperativos ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-gray-900">Reportes Operativos</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Disponibles para: <strong>Administradores y Gerentes</strong>
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Stock Alertas */}
              <button
                onClick={() => router.push('/dashboard/reportes/operativos/stock-alertas')}
                className="bg-white rounded-xl p-5 border border-gray-200 hover:border-amber-500 hover:shadow-lg transition-all text-left group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center group-hover:bg-amber-500 transition-colors">
                    <Package className="w-6 h-6 text-amber-600 group-hover:text-white" />
                  </div>
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                    Activo
                  </span>
                </div>
                <h3 className="font-bold text-gray-900 mb-1">Stock Mínimo y Máximo</h3>
                <p className="text-sm text-gray-600">
                  Alertas de inventario con clasificación por niveles
                </p>
              </button>

              {/* Lento Movimiento */}
              <button
                onClick={() => router.push('/dashboard/reportes/operativos/lento-movimiento')}
                className="bg-white rounded-xl p-5 border border-gray-200 hover:border-orange-500 hover:shadow-lg transition-all text-left group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-500 transition-colors">
                    <Clock className="w-6 h-6 text-orange-600 group-hover:text-white" />
                  </div>
                  <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
                    Activo
                  </span>
                </div>
                <h3 className="font-bold text-gray-900 mb-1">Productos de Lento Movimiento</h3>
                <p className="text-sm text-gray-600">
                  Identifica productos sin ventas por períodos prolongados
                </p>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gray-100 rounded-xl p-6 text-center border border-gray-200">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-700 mb-1">Reportes Operativos</h3>
            <p className="text-sm text-gray-500">
              Disponibles solo para Administradores y Gerentes
            </p>
          </div>
        )}

        {/* Reportes Financieros */}
        {puedeVerFinancieros ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-5 h-5 text-green-600" />
              <h2 className="text-lg font-bold text-gray-900">Reportes Financieros</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Disponibles para: <strong>Administradores y Gerentes</strong>
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Valoración Inventario */}
              <button
                onClick={() => router.push('/dashboard/reportes/financieros/valoracion-inventario')}
                className="bg-white rounded-xl p-5 border border-gray-200 hover:border-emerald-500 hover:shadow-lg transition-all text-left group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-500 transition-colors">
                    <Package className="w-6 h-6 text-emerald-600 group-hover:text-white" />
                  </div>
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                    Activo
                  </span>
                </div>
                <h3 className="font-bold text-gray-900 mb-1">Valoración de Inventario</h3>
                <p className="text-sm text-gray-600">
                  Valor total del stock actual por categoría
                </p>
              </button>

              {/* Rentabilidad */}
              <button
                onClick={() => router.push('/dashboard/reportes/financieros/rentabilidad')}
                className="bg-white rounded-xl p-5 border border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all text-left group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                    <TrendingUp className="w-6 h-6 text-blue-600 group-hover:text-white" />
                  </div>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                    Activo
                  </span>
                </div>
                <h3 className="font-bold text-gray-900 mb-1">Rentabilidad por Producto</h3>
                <p className="text-sm text-gray-600">
                  Análisis de ganancias netas y márgenes por producto
                </p>
              </button>

              {/* Margen Contribución */}
              <button
                onClick={() => router.push('/dashboard/reportes/financieros/margen-contribucion')}
                className="bg-white rounded-xl p-5 border border-gray-200 hover:border-amber-500 hover:shadow-lg transition-all text-left group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center group-hover:bg-amber-500 transition-colors">
                    <PieChart className="w-6 h-6 text-amber-600 group-hover:text-white" />
                  </div>
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                    Activo
                  </span>
                </div>
                <h3 className="font-bold text-gray-900 mb-1">Margen de Contribución</h3>
                <p className="text-sm text-gray-600">
                  Aporte de cada producto a cubrir costos fijos
                </p>
              </button>

              {/* Punto de Equilibrio - DESTACADO */}
              <button
                onClick={() => router.push('/dashboard/reportes/financieros/punto-equilibrio')}
                className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 border-2 border-emerald-400 hover:shadow-2xl transition-all text-left group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-10 rounded-full -mr-12 -mt-12"></div>
                <div className="flex items-start justify-between mb-3 relative z-10">
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                    <Target className="w-6 h-6 text-white" />
                  </div>
                  <span className="px-2 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full flex items-center gap-1">
                    ⭐ ESTRELLA
                  </span>
                </div>
                <h3 className="font-bold text-white mb-1 relative z-10">Punto de Equilibrio</h3>
                <p className="text-sm text-emerald-50 relative z-10">
                  Análisis completo de rentabilidad y break-even point
                </p>
              </button>

              {/* Estado de Resultados - NUEVO ⭐ */}
              <button
                onClick={() => router.push('/dashboard/reportes/financieros/estado-resultados')}
                className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 border-2 border-green-400 hover:shadow-2xl transition-all text-left group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-10 rounded-full -mr-12 -mt-12"></div>
                <div className="flex items-start justify-between mb-3 relative z-10">
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                    <DollarSign className="w-6 h-6 text-white" />
                  </div>
                  <span className="px-2 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full flex items-center gap-1">
                    ⭐ NUEVO
                  </span>
                </div>
                <h3 className="font-bold text-white mb-1 relative z-10">Estado de Resultados</h3>
                <p className="text-sm text-green-50 relative z-10">
                  Ganancias netas detalladas por día, semana y mes
                </p>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gray-100 rounded-xl p-6 text-center border border-gray-200">
            <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-700 mb-1">Reportes Financieros</h3>
            <p className="text-sm text-gray-500">
              Disponibles solo para Administradores y Gerentes
            </p>
          </div>
        )}

        {/* Info adicional */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="font-semibold text-blue-900 mb-2">💡 Sobre los Reportes</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Todos los datos se actualizan en <strong>tiempo real</strong></li>
            <li>• Puedes exportar cualquier reporte a <strong>Excel</strong></li>
            <li>• Los reportes financieros requieren configurar tus <strong>costos fijos</strong> en Configuración</li>
            <li>• El sistema usa algoritmos de <strong>Machine Learning</strong> para pronósticos</li>
          </ul>
        </div>
      </div>
    </div>
  )
}