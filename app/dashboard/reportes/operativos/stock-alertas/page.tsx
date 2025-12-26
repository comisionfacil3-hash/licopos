// Path: app\dashboard\reportes\operativos\stock-alertas\page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Download, ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  Legend
} from 'recharts'
import {
  exportarAExcel,
  prepararDatosParaExcel,
  formatearMoneda
} from '@/lib/utils/reportes'

type NivelStock = 'sin-stock' | 'stock-bajo' | 'stock-normal' | 'stock-alto'

interface ProductoStock {
  producto_id: string
  codigo: string
  nombre: string
  categoria: string
  stock_actual: number
  stock_minimo: number
  stock_maximo: number
  nivel: NivelStock
  diferencia_minimo: number
  diferencia_maximo: number
  precio_compra: number
  valor_inventario: number
}

interface ResumenStock {
  sin_stock: number
  stock_bajo: number
  stock_normal: number
  stock_alto: number
}

export default function StockAlertasPage() {
  const { usuario, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [productos, setProductos] = useState<ProductoStock[]>([])
  const [filtroNivel, setFiltroNivel] = useState<NivelStock | 'todos'>('todos')
  const [resumen, setResumen] = useState<ResumenStock>({
    sin_stock: 0,
    stock_bajo: 0,
    stock_normal: 0,
    stock_alto: 0
  })

  useEffect(() => {
    if (usuario) {
      cargarStockProductos()
    }
  }, [usuario])

  async function cargarStockProductos() {
    try {
      setLoading(true)

      const { data: productosData, error } = await supabase
        .from('productos')
        .select(`
          id,
          codigo,
          nombre,
          stock_actual,
          stock_minimo,
          stock_maximo,
          precio_compra,
          categoria:categorias(nombre)
        `)
        .eq('sucursal_id', usuario?.sucursal_id)
        .eq('activo', true)
        .order('nombre', { ascending: true })

      if (error) throw error

      // Clasificar productos por nivel de stock
      const productosConNivel: ProductoStock[] = productosData?.map((p: any) => {
        let nivel: NivelStock = 'stock-normal'
        
        if (p.stock_actual === 0) {
          nivel = 'sin-stock'
        } else if (p.stock_actual <= p.stock_minimo) {
          nivel = 'stock-bajo'
        } else if (p.stock_actual >= p.stock_maximo) {
          nivel = 'stock-alto'
        }

        return {
          producto_id: p.id,
          codigo: p.codigo,
          nombre: p.nombre,
          categoria: p.categoria?.nombre || 'Sin categoría',
          stock_actual: p.stock_actual,
          stock_minimo: p.stock_minimo,
          stock_maximo: p.stock_maximo,
          nivel,
          diferencia_minimo: p.stock_actual - p.stock_minimo,
          diferencia_maximo: p.stock_maximo - p.stock_actual,
          precio_compra: parseFloat(p.precio_compra),
          valor_inventario: p.stock_actual * parseFloat(p.precio_compra)
        }
      }) || []

      // Calcular resumen
      const nuevoResumen: ResumenStock = {
        sin_stock: productosConNivel.filter(p => p.nivel === 'sin-stock').length,
        stock_bajo: productosConNivel.filter(p => p.nivel === 'stock-bajo').length,
        stock_normal: productosConNivel.filter(p => p.nivel === 'stock-normal').length,
        stock_alto: productosConNivel.filter(p => p.nivel === 'stock-alto').length
      }

      setProductos(productosConNivel)
      setResumen(nuevoResumen)
    } catch (error) {
      console.error('Error cargando stock:', error)
    } finally {
      setLoading(false)
    }
  }

  function exportarExcel() {
    const productosFiltrados = filtroNivel === 'todos' 
      ? productos 
      : productos.filter(p => p.nivel === filtroNivel)

    const datosExcel = productosFiltrados.map((p) => ({
      'Código': p.codigo,
      'Producto': p.nombre,
      'Categoría': p.categoria,
      'Stock Actual': p.stock_actual,
      'Stock Mínimo': p.stock_minimo,
      'Stock Máximo': p.stock_maximo,
      'Estado': p.nivel === 'sin-stock' ? 'Sin Stock' :
                p.nivel === 'stock-bajo' ? 'Stock Bajo' :
                p.nivel === 'stock-alto' ? 'Stock Alto' : 'Normal',
      'Diferencia Mínimo': p.diferencia_minimo,
      'Diferencia Máximo': p.diferencia_maximo,
      'Valor Inventario (Bs.)': p.valor_inventario
    }))

    const datosLimpios = prepararDatosParaExcel(datosExcel)

    exportarAExcel(
      datosLimpios,
      'Stock Alertas',
      `stock-alertas-${new Date().toISOString().split('T')[0]}`
    )
  }

  if (authLoading || loading) {
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

  // Preparar datos para gráfica
  const datosGrafica = [
    { nombre: 'Sin Stock', cantidad: resumen.sin_stock, color: '#DC2626' }, // red-600
    { nombre: 'Stock Bajo', cantidad: resumen.stock_bajo, color: '#F59E0B' }, // amber-500
    { nombre: 'Stock Normal', cantidad: resumen.stock_normal, color: '#10B981' }, // emerald-500
    { nombre: 'Stock Alto', cantidad: resumen.stock_alto, color: '#3B82F6' } // blue-500
  ]

  const productosFiltrados = filtroNivel === 'todos' 
    ? productos 
    : productos.filter(p => p.nivel === filtroNivel)

  const valorTotalInventario = productos.reduce((sum, p) => sum + p.valor_inventario, 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-8">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => router.push('/dashboard/reportes')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">📦 Stock Mínimo y Máximo</h1>
              <p className="text-sm text-gray-600">Alertas de inventario</p>
            </div>
          </div>

          {/* Filtros por nivel */}
          <div className="flex gap-2 overflow-x-auto pb-2 mt-4">
            <button
              onClick={() => setFiltroNivel('todos')}
              className={`
                px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                ${filtroNivel === 'todos'
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
              `}
            >
              Todos ({productos.length})
            </button>
            <button
              onClick={() => setFiltroNivel('sin-stock')}
              className={`
                px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                ${filtroNivel === 'sin-stock'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
                }
              `}
            >
              🔴 Sin Stock ({resumen.sin_stock})
            </button>
            <button
              onClick={() => setFiltroNivel('stock-bajo')}
              className={`
                px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                ${filtroNivel === 'stock-bajo'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }
              `}
            >
              🟡 Stock Bajo ({resumen.stock_bajo})
            </button>
            <button
              onClick={() => setFiltroNivel('stock-normal')}
              className={`
                px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                ${filtroNivel === 'stock-normal'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }
              `}
            >
              🟢 Normal ({resumen.stock_normal})
            </button>
            <button
              onClick={() => setFiltroNivel('stock-alto')}
              className={`
                px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                ${filtroNivel === 'stock-alto'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }
              `}
            >
              🔵 Stock Alto ({resumen.stock_alto})
            </button>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4 max-w-7xl mx-auto">
        {productos.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No hay productos registrados
            </h3>
            <p className="text-gray-600">
              Crea productos para ver el estado del inventario
            </p>
          </div>
        ) : (
          <>
            {/* Resumen */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-white p-4 rounded-lg border-2 border-red-200">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <p className="text-sm text-gray-600">Sin Stock</p>
                </div>
                <p className="text-2xl font-bold text-red-600">{resumen.sin_stock}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border-2 border-amber-200">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <p className="text-sm text-gray-600">Stock Bajo</p>
                </div>
                <p className="text-2xl font-bold text-amber-600">{resumen.stock_bajo}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border-2 border-emerald-200">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <p className="text-sm text-gray-600">Normal</p>
                </div>
                <p className="text-2xl font-bold text-emerald-600">{resumen.stock_normal}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border-2 border-blue-200">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-5 h-5 text-blue-600" />
                  <p className="text-sm text-gray-600">Stock Alto</p>
                </div>
                <p className="text-2xl font-bold text-blue-600">{resumen.stock_alto}</p>
              </div>
            </div>

            {/* Card valor total */}
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl p-6 mb-4 text-white">
              <p className="text-sm opacity-90 mb-1">Valor Total del Inventario</p>
              <p className="text-3xl font-bold">{formatearMoneda(valorTotalInventario)}</p>
              <p className="text-sm opacity-75 mt-1">{productos.length} productos activos</p>
            </div>

            {/* Gráfica */}
            <div className="bg-white rounded-xl p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">
                  📊 Distribución de Stock
                </h2>
                <button
                  onClick={exportarExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg 
                           hover:bg-emerald-700 transition-colors text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Exportar Excel</span>
                </button>
              </div>

              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datosGrafica}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nombre" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="cantidad" name="Cantidad de Productos" radius={[8, 8, 0, 0]}>
                      {datosGrafica.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tabla detallada */}
            <div className="bg-white rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        Producto
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">
                        Categoría
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                        Actual
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">
                        Mínimo
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">
                        Máximo
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase hidden xl:table-cell">
                        Valor
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {productosFiltrados.map((producto) => (
                      <tr key={producto.producto_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          {producto.nivel === 'sin-stock' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                              🔴 Sin Stock
                            </span>
                          )}
                          {producto.nivel === 'stock-bajo' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                              🟡 Bajo
                            </span>
                          )}
                          {producto.nivel === 'stock-normal' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                              🟢 Normal
                            </span>
                          )}
                          {producto.nivel === 'stock-alto' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                              🔵 Alto
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{producto.nombre}</p>
                            <p className="text-sm text-gray-500">{producto.codigo}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-sm hidden md:table-cell">
                          {producto.categoria}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-bold text-lg ${
                            producto.nivel === 'sin-stock' ? 'text-red-600' :
                            producto.nivel === 'stock-bajo' ? 'text-amber-600' :
                            producto.nivel === 'stock-alto' ? 'text-blue-600' :
                            'text-emerald-600'
                          }`}>
                            {producto.stock_actual}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600 hidden lg:table-cell">
                          {producto.stock_minimo}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600 hidden lg:table-cell">
                          {producto.stock_maximo}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900 font-medium hidden xl:table-cell">
                          {formatearMoneda(producto.valor_inventario)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Info */}
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">💡 Clasificación de Stock</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>🔴 Sin Stock:</strong> Stock actual = 0 (requiere compra urgente)</li>
                <li>• <strong>🟡 Stock Bajo:</strong> Stock actual ≤ Stock mínimo (debe reabastecerse)</li>
                <li>• <strong>🟢 Normal:</strong> Stock entre mínimo y máximo (nivel óptimo)</li>
                <li>• <strong>🔵 Stock Alto:</strong> Stock actual ≥ Stock máximo (exceso de inventario)</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
