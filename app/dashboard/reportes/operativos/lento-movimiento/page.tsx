// Path: app\dashboard\reportes\operativos\lento-movimiento\page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Download, ArrowLeft, Clock, AlertCircle } from 'lucide-react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts'
import {
  exportarAExcel,
  prepararDatosParaExcel,
  formatearMoneda,
  COLORES_GRAFICAS
} from '@/lib/utils/reportes'

interface ProductoLento {
  producto_id: string
  codigo: string
  nombre: string
  categoria: string
  stock_actual: number
  precio_compra: number
  precio_venta: number
  valor_inventario: number
  ultima_venta: string | null
  dias_sin_venta: number
  total_vendido_historico: number
  cantidad_vendida_historica: number
}

export default function LentoMovimientoPage() {
  const { usuario, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [productos, setProductos] = useState<ProductoLento[]>([])
  const [diasFiltro, setDiasFiltro] = useState(30)
  const [limiteMostrar, setLimiteMostrar] = useState(20)

  useEffect(() => {
    if (usuario) {
      cargarProductosLentos()
    }
  }, [usuario, diasFiltro])

  async function cargarProductosLentos() {
    try {
      setLoading(true)

      // Obtener todos los productos activos con stock
      const { data: productosData, error: errorProductos } = await supabase
        .from('productos')
        .select(`
          id,
          codigo,
          nombre,
          stock_actual,
          precio_compra,
          precio_venta,
          categoria:categorias(nombre)
        `)
        .eq('sucursal_id', usuario?.sucursal_id)
        .eq('activo', true)
        .gt('stock_actual', 0)

      if (errorProductos) throw errorProductos

      // Obtener todas las ventas completadas
      const { data: ventasData, error: errorVentas } = await supabase
        .from('venta_detalles')
        .select(`
          producto_id,
          cantidad,
          venta:ventas!inner (
            created_at,
            estado,
            sucursal_id
          )
        `)
        .eq('venta.estado', 'completada')
        .eq('venta.sucursal_id', usuario?.sucursal_id)

      if (errorVentas) throw errorVentas

      // Agrupar ventas por producto
      const ventasPorProducto = new Map<string, {
        ultima_venta: Date | null
        total_vendido: number
        cantidad_vendida: number
      }>()

      ventasData?.forEach((vd: any) => {
        const fechaVenta = new Date(vd.venta.created_at)
        const actual = ventasPorProducto.get(vd.producto_id)
        
        if (!actual || fechaVenta > actual.ultima_venta!) {
          ventasPorProducto.set(vd.producto_id, {
            ultima_venta: fechaVenta,
            total_vendido: (actual?.total_vendido || 0) + vd.cantidad,
            cantidad_vendida: (actual?.cantidad_vendida || 0) + vd.cantidad
          })
        } else {
          actual.total_vendido += vd.cantidad
          actual.cantidad_vendida += vd.cantidad
        }
      })

      // Procesar productos
      const hoy = new Date()
      const productosLentos: ProductoLento[] = []

      productosData?.forEach((p: any) => {
        const ventaInfo = ventasPorProducto.get(p.id)
        const ultimaVenta = ventaInfo?.ultima_venta || null
        
        let diasSinVenta = 999
        if (ultimaVenta) {
          diasSinVenta = Math.floor((hoy.getTime() - ultimaVenta.getTime()) / (1000 * 60 * 60 * 24))
        }

        // Solo incluir productos que cumplan el filtro de días
        if (diasSinVenta >= diasFiltro) {
          productosLentos.push({
            producto_id: p.id,
            codigo: p.codigo,
            nombre: p.nombre,
            categoria: p.categoria?.nombre || 'Sin categoría',
            stock_actual: p.stock_actual,
            precio_compra: parseFloat(p.precio_compra),
            precio_venta: parseFloat(p.precio_venta),
            valor_inventario: p.stock_actual * parseFloat(p.precio_compra),
            ultima_venta: ultimaVenta ? ultimaVenta.toISOString() : null,
            dias_sin_venta: diasSinVenta,
            total_vendido_historico: ventaInfo?.total_vendido || 0,
            cantidad_vendida_historica: ventaInfo?.cantidad_vendida || 0
          })
        }
      })

      // Ordenar por días sin venta (descendente)
      productosLentos.sort((a, b) => b.dias_sin_venta - a.dias_sin_venta)

      setProductos(productosLentos)
    } catch (error) {
      console.error('Error cargando productos lentos:', error)
    } finally {
      setLoading(false)
    }
  }

  function exportarExcel() {
    const datosExcel = productos.slice(0, limiteMostrar).map((p) => ({
      'Código': p.codigo,
      'Producto': p.nombre,
      'Categoría': p.categoria,
      'Stock Actual': p.stock_actual,
      'Días Sin Venta': p.dias_sin_venta === 999 ? 'Nunca vendido' : p.dias_sin_venta,
      'Última Venta': p.ultima_venta ? new Date(p.ultima_venta).toLocaleDateString('es-BO') : 'Nunca',
      'Vendido Histórico': p.cantidad_vendida_historica,
      'Valor Inventario (Bs.)': p.valor_inventario,
      'Precio Compra (Bs.)': p.precio_compra,
      'Precio Venta (Bs.)': p.precio_venta
    }))

    const datosLimpios = prepararDatosParaExcel(datosExcel)

    exportarAExcel(
      datosLimpios,
      'Productos Lento Movimiento',
      `lento-movimiento-${diasFiltro}dias-${new Date().toISOString().split('T')[0]}`
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

  const productosParaGrafica = productos.slice(0, 10).map(p => ({
    nombre: p.nombre.length > 15 ? p.nombre.substring(0, 15) + '...' : p.nombre,
    dias: p.dias_sin_venta === 999 ? 365 : p.dias_sin_venta
  }))

  const valorTotalEstancado = productos.reduce((sum, p) => sum + p.valor_inventario, 0)
  const unidadesEstancadas = productos.reduce((sum, p) => sum + p.stock_actual, 0)

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
              <h1 className="text-xl font-bold text-gray-900">🐌 Productos de Lento Movimiento</h1>
              <p className="text-sm text-gray-600">Artículos sin ventas en período prolongado</p>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-col gap-3 mt-4">
            {/* Días sin venta */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mostrar productos sin venta por al menos:
              </label>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {[7, 15, 30, 60, 90, 180].map((dias) => (
                  <button
                    key={dias}
                    onClick={() => setDiasFiltro(dias)}
                    className={`
                      px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                      ${diasFiltro === dias
                        ? 'bg-amber-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }
                    `}
                  >
                    {dias} días
                  </button>
                ))}
              </div>
            </div>

            {/* Límite a mostrar */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Mostrar:</span>
              <div className="flex gap-2">
                {[20, 50, 100].map((num) => (
                  <button
                    key={num}
                    onClick={() => setLimiteMostrar(num)}
                    className={`
                      px-3 py-1 rounded-lg text-sm font-medium transition-colors
                      ${limiteMostrar === num
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }
                    `}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4 max-w-7xl mx-auto">
        {productos.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              ¡Excelente! No hay productos de lento movimiento
            </h3>
            <p className="text-gray-600">
              Todos tus productos han tenido ventas en los últimos {diasFiltro} días
            </p>
          </div>
        ) : (
          <>
            {/* Resumen */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="bg-white p-4 rounded-lg border-2 border-amber-200">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <p className="text-sm text-gray-600">Productos Estancados</p>
                </div>
                <p className="text-2xl font-bold text-amber-600">{productos.length}</p>
                <p className="text-xs text-gray-500 mt-1">≥ {diasFiltro} días sin venta</p>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-5 h-5 text-gray-600" />
                  <p className="text-sm text-gray-600">Unidades Estancadas</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">{unidadesEstancadas}</p>
                <p className="text-xs text-gray-500 mt-1">en inventario</p>
              </div>
              <div className="bg-white p-4 rounded-lg border-2 border-red-200">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-sm text-gray-600">Capital Estancado</p>
                </div>
                <p className="text-2xl font-bold text-red-600">
                  {formatearMoneda(valorTotalEstancado)}
                </p>
                <p className="text-xs text-gray-500 mt-1">valor de compra</p>
              </div>
            </div>

            {/* Gráfica */}
            <div className="bg-white rounded-xl p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">
                  📊 Top 10 Productos con Más Días Sin Venta
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

              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productosParaGrafica} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" label={{ value: 'Días sin venta', position: 'insideBottom', offset: -5 }} />
                    <YAxis 
                      dataKey="nombre" 
                      type="category" 
                      width={150}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      formatter={(value: any) => [`${value} días`, 'Sin venta']}
                    />
                    <Bar dataKey="dias" radius={[0, 8, 8, 0]}>
                      {productosParaGrafica.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.dias >= 180 ? '#DC2626' : entry.dias >= 90 ? '#F59E0B' : '#F97316'} 
                        />
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
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        Producto
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">
                        Categoría
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                        Stock
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                        Días Sin Venta
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">
                        Última Venta
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase hidden xl:table-cell">
                        Valor Estancado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {productos.slice(0, limiteMostrar).map((producto, index) => (
                      <tr key={producto.producto_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-semibold text-sm">
                            {index + 1}
                          </span>
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
                          <span className="font-semibold text-gray-900">
                            {producto.stock_actual}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            producto.dias_sin_venta >= 180
                              ? 'bg-red-100 text-red-700'
                              : producto.dias_sin_venta >= 90
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {producto.dias_sin_venta === 999 ? 'Nunca' : `${producto.dias_sin_venta} días`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-sm hidden lg:table-cell">
                          {producto.ultima_venta 
                            ? new Date(producto.ultima_venta).toLocaleDateString('es-BO', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })
                            : 'Nunca vendido'
                          }
                        </td>
                        <td className="px-4 py-3 text-right text-red-600 font-semibold hidden xl:table-cell">
                          {formatearMoneda(producto.valor_inventario)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recomendaciones */}
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h3 className="font-semibold text-amber-900 mb-2">💡 Recomendaciones</h3>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>• Considera hacer <strong>promociones</strong> o <strong>descuentos</strong> en estos productos</li>
                <li>• Evalúa si es necesario seguir comprando estos artículos</li>
                <li>• Revisa si el <strong>precio de venta</strong> es competitivo</li>
                <li>• Verifica que los productos estén <strong>visibles</strong> para los clientes</li>
                <li>• El capital estancado podría invertirse en productos de <strong>mayor rotación</strong></li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
