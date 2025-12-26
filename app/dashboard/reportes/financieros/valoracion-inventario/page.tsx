// Path: app\dashboard\reportes\financieros\valoracion-inventario\page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Download, ArrowLeft, Package, TrendingUp } from 'lucide-react'
import { 
  PieChart, 
  Pie, 
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts'
import {
  exportarAExcel,
  prepararDatosParaExcel,
  formatearMoneda,
  COLORES_GRAFICAS
} from '@/lib/utils/reportes'

interface ProductoValoracion {
  producto_id: string
  codigo: string
  nombre: string
  categoria: string
  stock_actual: number
  precio_compra: number
  precio_venta: number
  valor_compra: number
  valor_venta: number
  utilidad_potencial: number
  margen_potencial: number
}

interface ResumenCategoria {
  categoria: string
  productos: number
  unidades: number
  valor_compra: number
  valor_venta: number
  porcentaje: number
}

export default function ValoracionInventarioPage() {
  const { usuario, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [productos, setProductos] = useState<ProductoValoracion[]>([])
  const [categorias, setCategorias] = useState<ResumenCategoria[]>([])
  const [ordenarPor, setOrdenarPor] = useState<'valor' | 'nombre' | 'categoria'>('valor')

  useEffect(() => {
    if (usuario) {
      cargarValoracion()
    }
  }, [usuario])

  async function cargarValoracion() {
    try {
      setLoading(true)

      const { data: productosData, error } = await supabase
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

      if (error) throw error

      // Procesar productos
      const productosValoracion: ProductoValoracion[] = productosData?.map((p: any) => {
        const precioCompra = parseFloat(p.precio_compra)
        const precioVenta = parseFloat(p.precio_venta)
        const valorCompra = p.stock_actual * precioCompra
        const valorVenta = p.stock_actual * precioVenta
        const utilidadPotencial = valorVenta - valorCompra
        const margenPotencial = precioCompra > 0 ? ((precioVenta - precioCompra) / precioCompra) * 100 : 0

        return {
          producto_id: p.id,
          codigo: p.codigo,
          nombre: p.nombre,
          categoria: p.categoria?.nombre || 'Sin categoría',
          stock_actual: p.stock_actual,
          precio_compra: precioCompra,
          precio_venta: precioVenta,
          valor_compra: valorCompra,
          valor_venta: valorVenta,
          utilidad_potencial: utilidadPotencial,
          margen_potencial: margenPotencial
        }
      }) || []

      // Agrupar por categoría
      const categoriaMap = new Map<string, ResumenCategoria>()
      const totalValor = productosValoracion.reduce((sum, p) => sum + p.valor_compra, 0)

      productosValoracion.forEach((p) => {
        const existing = categoriaMap.get(p.categoria)
        if (existing) {
          existing.productos += 1
          existing.unidades += p.stock_actual
          existing.valor_compra += p.valor_compra
          existing.valor_venta += p.valor_venta
        } else {
          categoriaMap.set(p.categoria, {
            categoria: p.categoria,
            productos: 1,
            unidades: p.stock_actual,
            valor_compra: p.valor_compra,
            valor_venta: p.valor_venta,
            porcentaje: 0
          })
        }
      })

      // Calcular porcentajes
      const categoriasArray = Array.from(categoriaMap.values()).map(cat => ({
        ...cat,
        porcentaje: totalValor > 0 ? (cat.valor_compra / totalValor) * 100 : 0
      }))

      // Ordenar por valor
      categoriasArray.sort((a, b) => b.valor_compra - a.valor_compra)

      setProductos(productosValoracion)
      setCategorias(categoriasArray)
    } catch (error) {
      console.error('Error cargando valoración:', error)
    } finally {
      setLoading(false)
    }
  }

  function exportarExcel() {
    // Hoja 1: Resumen por categoría
    const datosCategoria = categorias.map((cat) => ({
      'Categoría': cat.categoria,
      'Productos': cat.productos,
      'Unidades': cat.unidades,
      'Valor Compra (Bs.)': cat.valor_compra,
      'Valor Venta (Bs.)': cat.valor_venta,
      'Utilidad Potencial (Bs.)': cat.valor_venta - cat.valor_compra,
      '% del Total': cat.porcentaje
    }))

    // Hoja 2: Detalle por producto
    const datosProductos = productosOrdenados.map((p) => ({
      'Código': p.codigo,
      'Producto': p.nombre,
      'Categoría': p.categoria,
      'Stock': p.stock_actual,
      'Precio Compra (Bs.)': p.precio_compra,
      'Precio Venta (Bs.)': p.precio_venta,
      'Valor Compra Total (Bs.)': p.valor_compra,
      'Valor Venta Total (Bs.)': p.valor_venta,
      'Utilidad Potencial (Bs.)': p.utilidad_potencial,
      'Margen %': p.margen_potencial
    }))

    const datosLimpios1 = prepararDatosParaExcel(datosCategoria)
    const datosLimpios2 = prepararDatosParaExcel(datosProductos)

    // Exportar ambas hojas (simplificado - solo exportamos productos)
    exportarAExcel(
      datosLimpios2,
      'Valoración Inventario',
      `valoracion-inventario-${new Date().toISOString().split('T')[0]}`
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

  // Ordenar productos
  let productosOrdenados = [...productos]
  if (ordenarPor === 'valor') {
    productosOrdenados.sort((a, b) => b.valor_compra - a.valor_compra)
  } else if (ordenarPor === 'nombre') {
    productosOrdenados.sort((a, b) => a.nombre.localeCompare(b.nombre))
  } else if (ordenarPor === 'categoria') {
    productosOrdenados.sort((a, b) => a.categoria.localeCompare(b.categoria))
  }

  const totalValorCompra = productos.reduce((sum, p) => sum + p.valor_compra, 0)
  const totalValorVenta = productos.reduce((sum, p) => sum + p.valor_venta, 0)
  const totalUtilidadPotencial = totalValorVenta - totalValorCompra
  const totalUnidades = productos.reduce((sum, p) => sum + p.stock_actual, 0)
  const margenPromedio = totalValorCompra > 0 ? ((totalValorVenta - totalValorCompra) / totalValorCompra) * 100 : 0

  // Datos para gráfica (top 5 categorías)
  const datosGrafica = categorias.slice(0, 5).map((cat, index) => ({
    name: cat.categoria,
    value: cat.valor_compra,
    fill: [
      COLORES_GRAFICAS.principal,
      COLORES_GRAFICAS.secundario,
      COLORES_GRAFICAS.terciario,
      COLORES_GRAFICAS.advertencia,
      '#8B5CF6'
    ][index]
  }))

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
              <h1 className="text-xl font-bold text-gray-900">💎 Valoración de Inventario</h1>
              <p className="text-sm text-gray-600">Valor total del stock actual</p>
            </div>
          </div>

          {/* Ordenar por */}
          <div className="flex items-center gap-2 mt-4">
            <span className="text-sm text-gray-600">Ordenar por:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setOrdenarPor('valor')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  ordenarPor === 'valor'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Valor
              </button>
              <button
                onClick={() => setOrdenarPor('nombre')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  ordenarPor === 'nombre'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Nombre
              </button>
              <button
                onClick={() => setOrdenarPor('categoria')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  ordenarPor === 'categoria'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Categoría
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4 max-w-7xl mx-auto">
        {productos.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No hay productos en inventario
            </h3>
            <p className="text-gray-600">
              Registra compras para ver la valoración de tu inventario
            </p>
          </div>
        ) : (
          <>
            {/* Cards de resumen */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-5 h-5" />
                  <p className="text-sm opacity-90">Valor de Compra</p>
                </div>
                <p className="text-3xl font-bold">{formatearMoneda(totalValorCompra)}</p>
                <p className="text-sm opacity-75 mt-1">{totalUnidades} unidades</p>
              </div>

              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5" />
                  <p className="text-sm opacity-90">Valor de Venta</p>
                </div>
                <p className="text-3xl font-bold">{formatearMoneda(totalValorVenta)}</p>
                <p className="text-sm opacity-75 mt-1">Potencial</p>
              </div>

              <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-6 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5" />
                  <p className="text-sm opacity-90">Utilidad Potencial</p>
                </div>
                <p className="text-3xl font-bold">{formatearMoneda(totalUtilidadPotencial)}</p>
                <p className="text-sm opacity-75 mt-1">Si vendes todo</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5" />
                  <p className="text-sm opacity-90">Margen Promedio</p>
                </div>
                <p className="text-3xl font-bold">{margenPromedio.toFixed(1)}%</p>
                <p className="text-sm opacity-75 mt-1">{productos.length} productos</p>
              </div>
            </div>

            {/* Grid: Gráfica + Tabla categorías */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              {/* Gráfica */}
              <div className="bg-white rounded-xl p-6">
                <h2 className="font-semibold text-gray-900 mb-4">
                  📊 Top 5 Categorías por Valor
                </h2>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={datosGrafica}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent = 0 }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {datosGrafica.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => formatearMoneda(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tabla de categorías */}
              <div className="bg-white rounded-xl p-6">
                <h2 className="font-semibold text-gray-900 mb-4">
                  📋 Resumen por Categoría
                </h2>
                <div className="overflow-auto max-h-[300px]">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                          Categoría
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">
                          Valor
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">
                          %
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {categorias.map((cat) => (
                        <tr key={cat.categoria} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-900">
                            {cat.categoria}
                            <span className="text-xs text-gray-500 ml-1">({cat.productos})</span>
                          </td>
                          <td className="px-3 py-2 text-right text-emerald-600 font-semibold">
                            {formatearMoneda(cat.valor_compra)}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {cat.porcentaje.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Tabla de productos */}
            <div className="bg-white rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">
                  📦 Detalle por Producto
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
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        Producto
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">
                        Categoría
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                        Stock
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">
                        P. Compra
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                        Valor Compra
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase hidden xl:table-cell">
                        Valor Venta
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase hidden xl:table-cell">
                        Utilidad Pot.
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {productosOrdenados.map((producto) => (
                      <tr key={producto.producto_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{producto.nombre}</p>
                            <p className="text-sm text-gray-500">{producto.codigo}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-sm hidden md:table-cell">
                          {producto.categoria}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-gray-900">
                          {producto.stock_actual}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 hidden lg:table-cell">
                          {formatearMoneda(producto.precio_compra)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                          {formatearMoneda(producto.valor_compra)}
                        </td>
                        <td className="px-4 py-3 text-right text-blue-600 font-medium hidden xl:table-cell">
                          {formatearMoneda(producto.valor_venta)}
                        </td>
                        <td className="px-4 py-3 text-right text-amber-600 font-medium hidden xl:table-cell">
                          {formatearMoneda(producto.utilidad_potencial)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Info */}
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">💡 Interpretación</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>Valor de Compra:</strong> Capital invertido en tu inventario actual</li>
                <li>• <strong>Valor de Venta:</strong> Ingresos potenciales si vendes todo el stock</li>
                <li>• <strong>Utilidad Potencial:</strong> Ganancia si vendes todo al precio actual</li>
                <li>• <strong>Margen Promedio:</strong> Porcentaje de ganancia promedio de tus productos</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  )
}