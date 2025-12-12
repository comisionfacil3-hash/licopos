'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { formatCurrency } from '@/lib/utils/format'
import { formatDateTime } from '@/lib/utils/timezone'
import * as XLSX from 'xlsx'

interface Producto {
  id: string
  nombre: string
  codigo: string
  precio_compra: number
  precio_venta: number
  stock_actual: number
}

interface Proveedor {
  id: string
  nombre: string
}

interface ItemCompra {
  producto_id: string | null
  producto_nombre: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

interface CompraDetalle {
  id: string
  producto_id: string | null
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  producto_nombre: string
}

interface Compra {
  id: string
  numero_compra: number
  tipo: 'producto' | 'insumo'
  total: number
  metodo_pago: string
  notas: string | null
  fecha_compra: string
  created_at: string
  proveedor_nombre: string | null
  usuario_nombre: string
  detalles: CompraDetalle[]
}

interface SaldoCaja {
  efectivo: number
  qr: number
}

export default function ComprasPage() {
  const [compras, setCompras] = useState<Compra[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroFecha, setFiltroFecha] = useState<'hoy' | 'semanal' | 'mensual'>('semanal')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'producto' | 'insumo'>('todos')
  const [compraSeleccionada, setCompraSeleccionada] = useState<Compra | null>(null)
  
  // Estados para nueva compra
  const [showNuevaCompra, setShowNuevaCompra] = useState(false)
  const [tipoCompra, setTipoCompra] = useState<'producto' | 'insumo'>('producto')
  const [proveedorId, setProveedorId] = useState('')
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'qr'>('efectivo')
  const [items, setItems] = useState<ItemCompra[]>([])
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [cajaAbierta, setCajaAbierta] = useState(false)
  const [cajaId, setCajaId] = useState<string | null>(null)
  const [saldoCaja, setSaldoCaja] = useState<SaldoCaja>({ efectivo: 0, qr: 0 })
  
  // Estados para agregar item
  const [productoSeleccionado, setProductoSeleccionado] = useState('')
  const [descripcionItem, setDescripcionItem] = useState('')
  const [cantidadItem, setCantidadItem] = useState('')
  const [precioItem, setPrecioItem] = useState('')
  
  // Estado para éxito
  const [showExito, setShowExito] = useState(false)
  const [compraExitosa, setCompraExitosa] = useState<number | null>(null)

  const { usuario } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (usuario?.sucursal_id) {
      loadData()
    }
  }, [usuario?.sucursal_id, filtroFecha])

  const loadData = async () => {
    if (!usuario?.sucursal_id) return

    setLoading(true)
    try {
      // Verificar caja abierta y obtener saldo
      const { data: cajaData } = await supabase
        .from('cajas')
        .select('id, monto_inicial, monto_inicial_qr')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('estado', 'abierta')
        .maybeSingle()

      setCajaAbierta(!!cajaData)
      setCajaId(cajaData?.id || null)

      // Calcular saldo disponible en caja
      if (cajaData) {
        const { data: movimientos } = await supabase
          .from('movimientos_caja')
          .select('tipo, monto, metodo_pago')
          .eq('caja_id', cajaData.id)

        let saldoEfectivo = cajaData.monto_inicial || 0
        let saldoQR = cajaData.monto_inicial_qr || 0

        if (movimientos) {
          movimientos.forEach(mov => {
            if (mov.metodo_pago === 'efectivo') {
              if (mov.tipo === 'ingreso') {
                saldoEfectivo += mov.monto
              } else if (mov.tipo === 'egreso' || mov.tipo === 'retiro') {
                saldoEfectivo -= mov.monto
              }
            } else if (mov.metodo_pago === 'qr') {
              if (mov.tipo === 'ingreso') {
                saldoQR += mov.monto
              } else if (mov.tipo === 'egreso') {
                saldoQR -= mov.monto
              }
            }
          })
        }

        setSaldoCaja({ efectivo: saldoEfectivo, qr: saldoQR })
      }

      // Calcular fechas según filtro
      const ahora = new Date()
      let fechaInicio: Date

      switch (filtroFecha) {
        case 'hoy':
          fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
          break
        case 'semanal':
          fechaInicio = new Date(ahora)
          fechaInicio.setDate(ahora.getDate() - 7)
          break
        case 'mensual':
          fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
          break
      }

      // Cargar compras
      const { data: comprasData } = await supabase
        .from('compras')
        .select('*')
        .eq('sucursal_id', usuario.sucursal_id)
        .gte('created_at', fechaInicio.toISOString())
        .order('created_at', { ascending: false })

      if (comprasData && comprasData.length > 0) {
        const proveedorIds = [...new Set(comprasData.filter(c => c.proveedor_id).map(c => c.proveedor_id))]
        const usuarioIds = [...new Set(comprasData.map(c => c.usuario_id))]
        const compraIds = comprasData.map(c => c.id)

        let proveedoresMap: Record<string, string> = {}
        if (proveedorIds.length > 0) {
          const { data: provData } = await supabase
            .from('proveedores')
            .select('id, nombre')
            .in('id', proveedorIds)
          if (provData) {
            provData.forEach(p => { proveedoresMap[p.id] = p.nombre })
          }
        }

        let usuariosMap: Record<string, string> = {}
        if (usuarioIds.length > 0) {
          const { data: usrData } = await supabase
            .from('usuarios')
            .select('id, nombre')
            .in('id', usuarioIds)
          if (usrData) {
            usrData.forEach(u => { usuariosMap[u.id] = u.nombre })
          }
        }

        const { data: detallesData } = await supabase
          .from('compra_detalles')
          .select('*')
          .in('compra_id', compraIds)

        let productosMap: Record<string, string> = {}
        if (detallesData && detallesData.length > 0) {
          const productoIds = [...new Set(detallesData.filter(d => d.producto_id).map(d => d.producto_id))]
          if (productoIds.length > 0) {
            const { data: prodData } = await supabase
              .from('productos')
              .select('id, nombre')
              .in('id', productoIds)
            if (prodData) {
              prodData.forEach(p => { productosMap[p.id] = p.nombre })
            }
          }
        }

        const comprasCompletas: Compra[] = comprasData.map(compra => {
          const detallesCompra = (detallesData || [])
            .filter(d => d.compra_id === compra.id)
            .map(d => ({
              id: d.id,
              producto_id: d.producto_id,
              descripcion: d.descripcion || '',
              cantidad: d.cantidad,
              precio_unitario: d.precio_unitario,
              subtotal: d.subtotal,
              producto_nombre: d.producto_id ? productosMap[d.producto_id] || 'Producto eliminado' : d.descripcion
            }))

          return {
            id: compra.id,
            numero_compra: compra.numero_compra,
            tipo: compra.tipo,
            total: compra.total,
            metodo_pago: compra.metodo_pago,
            notas: compra.notas,
            fecha_compra: compra.fecha_compra,
            created_at: compra.created_at,
            proveedor_nombre: compra.proveedor_id ? proveedoresMap[compra.proveedor_id] || null : null,
            usuario_nombre: usuariosMap[compra.usuario_id] || 'Desconocido',
            detalles: detallesCompra
          }
        })

        setCompras(comprasCompletas)
      } else {
        setCompras([])
      }

      // Cargar productos para el formulario
      const { data: productosData } = await supabase
        .from('productos')
        .select('id, nombre, codigo, precio_compra, precio_venta, stock_actual')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('activo', true)
        .order('nombre')

      setProductos(productosData || [])

      // Cargar proveedores para el formulario
      const { data: proveedoresData } = await supabase
        .from('proveedores')
        .select('id, nombre')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('activo', true)
        .order('nombre')

      setProveedores(proveedoresData || [])

    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }

  // Filtrar compras
  const comprasFiltradas = useMemo(() => {
    if (filtroTipo === 'todos') return compras
    return compras.filter(c => c.tipo === filtroTipo)
  }, [compras, filtroTipo])

  // Totales
  const totalCompras = comprasFiltradas.reduce((sum, c) => sum + c.total, 0)
  const totalProductos = comprasFiltradas.filter(c => c.tipo === 'producto').reduce((sum, c) => sum + c.total, 0)
  const totalInsumos = comprasFiltradas.filter(c => c.tipo === 'insumo').reduce((sum, c) => sum + c.total, 0)

  // Total del carrito actual
  const totalCarrito = items.reduce((sum, item) => sum + item.subtotal, 0)

  // Saldo disponible según método de pago
  const saldoDisponible = metodoPago === 'efectivo' ? saldoCaja.efectivo : saldoCaja.qr

  // Agregar item al carrito
  const agregarItem = () => {
    const cantidad = parseInt(cantidadItem) || 0
    const precio = parseFloat(precioItem) || 0

    if (cantidad <= 0 || precio <= 0) {
      setError('Cantidad y precio deben ser mayores a 0')
      return
    }

    if (tipoCompra === 'producto') {
      if (!productoSeleccionado) {
        setError('Seleccione un producto')
        return
      }
      const producto = productos.find(p => p.id === productoSeleccionado)
      if (!producto) return

      const existente = items.find(i => i.producto_id === productoSeleccionado)
      if (existente) {
        setItems(prev => prev.map(i => 
          i.producto_id === productoSeleccionado
            ? { ...i, cantidad: i.cantidad + cantidad, subtotal: (i.cantidad + cantidad) * i.precio_unitario }
            : i
        ))
      } else {
        setItems(prev => [...prev, {
          producto_id: producto.id,
          producto_nombre: producto.nombre,
          descripcion: '',
          cantidad,
          precio_unitario: precio,
          subtotal: cantidad * precio
        }])
      }
    } else {
      if (!descripcionItem.trim()) {
        setError('Ingrese una descripción')
        return
      }
      setItems(prev => [...prev, {
        producto_id: null,
        producto_nombre: '',
        descripcion: descripcionItem.trim(),
        cantidad,
        precio_unitario: precio,
        subtotal: cantidad * precio
      }])
    }

    setProductoSeleccionado('')
    setDescripcionItem('')
    setCantidadItem('')
    setPrecioItem('')
    setError('')
  }

  // Eliminar item del carrito
  const eliminarItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  // Guardar compra
  const guardarCompra = async () => {
    if (!usuario?.sucursal_id || !usuario?.id || !cajaId) return

    if (items.length === 0) {
      setError('Agregue al menos un item')
      return
    }

    // VALIDACIÓN: Verificar saldo disponible
    if (totalCarrito > saldoDisponible) {
      setError(`Saldo insuficiente. Disponible en ${metodoPago === 'efectivo' ? 'efectivo' : 'QR'}: ${formatCurrency(saldoDisponible)}`)
      return
    }

    setGuardando(true)
    setError('')

    try {
      const { data: maxCompra } = await supabase
        .from('compras')
        .select('numero_compra')
        .eq('sucursal_id', usuario.sucursal_id)
        .order('numero_compra', { ascending: false })
        .limit(1)
        .maybeSingle()

      const numeroCompra = (maxCompra?.numero_compra || 0) + 1

      const { data: compra, error: compraError } = await supabase
        .from('compras')
        .insert({
          sucursal_id: usuario.sucursal_id,
          proveedor_id: proveedorId || null,
          usuario_id: usuario.id,
          caja_id: cajaId,
          numero_compra: numeroCompra,
          tipo: tipoCompra,
          total: totalCarrito,
          metodo_pago: metodoPago,
          notas: notas || null
        })
        .select()
        .single()

      if (compraError) throw compraError

      const detalles = items.map(item => ({
        compra_id: compra.id,
        producto_id: item.producto_id,
        descripcion: item.descripcion || item.producto_nombre,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        subtotal: item.subtotal
      }))

      const { error: detallesError } = await supabase
        .from('compra_detalles')
        .insert(detalles)

      if (detallesError) throw detallesError

      await supabase.from('movimientos_caja').insert({
        caja_id: cajaId,
        tipo: 'egreso',
        concepto: `Compra #${numeroCompra} - ${tipoCompra === 'producto' ? 'Productos' : 'Insumos'}`,
        referencia_id: compra.id,
        referencia_tipo: 'compra',
        monto: totalCarrito,
        metodo_pago: metodoPago
      })

      setShowNuevaCompra(false)
      setItems([])
      setProveedorId('')
      setNotas('')
      setTipoCompra('producto')
      setMetodoPago('efectivo')

      setCompraExitosa(numeroCompra)
      setShowExito(true)
      setTimeout(() => {
        setShowExito(false)
        setCompraExitosa(null)
      }, 3000)

      loadData()

    } catch (err) {
      console.error('Error guardando compra:', err)
      setError('Error al guardar la compra')
    } finally {
      setGuardando(false)
    }
  }

  // Abrir modal nueva compra
  const abrirNuevaCompra = () => {
    if (!cajaAbierta) {
      setError('Debe abrir la caja antes de registrar compras')
      return
    }
    setItems([])
    setProveedorId('')
    setNotas('')
    setTipoCompra('producto')
    setMetodoPago('efectivo')
    setError('')
    setShowNuevaCompra(true)
  }

  // Exportar a Excel
  const exportarExcel = () => {
    if (comprasFiltradas.length === 0) return

    const datosExcel: any[] = []
    comprasFiltradas.forEach(compra => {
      compra.detalles.forEach(detalle => {
        datosExcel.push({
          'Compra #': compra.numero_compra,
          'Fecha': formatDateTime(compra.created_at),
          'Tipo': compra.tipo === 'producto' ? 'Producto' : 'Insumo',
          'Item': detalle.producto_nombre || detalle.descripcion,
          'Cantidad': detalle.cantidad,
          'Precio Unit.': detalle.precio_unitario,
          'Subtotal': detalle.subtotal,
          'Proveedor': compra.proveedor_nombre || 'Sin proveedor',
          'Método Pago': compra.metodo_pago === 'efectivo' ? 'Efectivo' : 'QR',
          'Usuario': compra.usuario_nombre,
          'Total Compra': compra.total
        })
      })
    })

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(datosExcel)
    XLSX.utils.book_append_sheet(wb, ws, 'Compras')
    XLSX.writeFile(wb, `Compras_${filtroFecha}.xlsx`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando compras...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24 max-w-4xl mx-auto">
      {/* Mensaje de éxito */}
      {showExito && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full animate-bounce-in">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Compra Registrada!</h2>
            <p className="text-emerald-600 text-lg font-medium">Compra #{compraExitosa}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compras</h1>
          <p className="text-gray-500 text-sm">{comprasFiltradas.length} compras en el período</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportarExcel}
            disabled={comprasFiltradas.length === 0}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <button
            onClick={abrirNuevaCompra}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva Compra
          </button>
        </div>
      </div>

      {!cajaAbierta && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          La caja está cerrada. Debe abrirla para registrar compras.
        </div>
      )}

      {/* Saldo disponible */}
      {cajaAbierta && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Saldo disponible en caja:
          </span>
          <span className="font-medium">
            Efectivo: {formatCurrency(saldoCaja.efectivo)} | QR: {formatCurrency(saldoCaja.qr)}
          </span>
        </div>
      )}

      {/* Filtros de fecha */}
      <div className="flex gap-2 mb-4">
        {(['hoy', 'semanal', 'mensual'] as const).map(filtro => (
          <button
            key={filtro}
            onClick={() => setFiltroFecha(filtro)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 ${
              filtroFecha === filtro
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {filtro === 'hoy' ? 'Hoy' : filtro === 'semanal' ? 'Semanal' : 'Mensual'}
          </button>
        ))}
      </div>

      {/* Filtros de tipo */}
      <div className="flex gap-2 mb-4">
        {(['todos', 'producto', 'insumo'] as const).map(tipo => (
          <button
            key={tipo}
            onClick={() => setFiltroTipo(tipo)}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 ${
              filtroTipo === tipo
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {tipo === 'todos' ? (
              'Todos'
            ) : tipo === 'producto' ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Productos
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Insumos
              </>
            )}
          </button>
        ))}
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-red-50 rounded-xl p-3 text-center">
          <p className="text-red-600 font-bold text-lg">{formatCurrency(totalCompras)}</p>
          <p className="text-red-700 text-xs">Total</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <p className="text-blue-600 font-bold text-lg">{formatCurrency(totalProductos)}</p>
          <p className="text-blue-700 text-xs">Productos</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 text-center">
          <p className="text-amber-600 font-bold text-lg">{formatCurrency(totalInsumos)}</p>
          <p className="text-amber-700 text-xs">Insumos</p>
        </div>
      </div>

      {/* Lista de compras */}
      {comprasFiltradas.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No hay compras</h3>
          <p className="text-gray-500">No se encontraron compras en este período</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comprasFiltradas.map(compra => (
            <div
              key={compra.id}
              onClick={() => setCompraSeleccionada(compra)}
              className="bg-white rounded-xl border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">Compra #{compra.numero_compra}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${
                      compra.tipo === 'producto' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {compra.tipo === 'producto' ? (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          Productos
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          Insumos
                        </>
                      )}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm">{formatDateTime(compra.created_at)}</p>
                  {compra.proveedor_nombre && (
                    <p className="text-gray-400 text-xs mt-1 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      {compra.proveedor_nombre}
                    </p>
                  )}
                  <p className="text-gray-400 text-xs">{compra.detalles.length} items</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg text-red-600">{formatCurrency(compra.total)}</p>
                  <p className="text-xs text-gray-500 flex items-center justify-end gap-1">
                    {compra.metodo_pago === 'efectivo' ? (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Efectivo
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        QR
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nueva Compra */}
      {showNuevaCompra && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Nueva Compra</h2>
                <button onClick={() => setShowNuevaCompra(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Saldo disponible en modal */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Saldo disponible:</span>
                  <div className="text-right">
                    <p className={metodoPago === 'efectivo' ? 'font-bold text-emerald-600' : 'text-gray-400'}>
                      Efectivo: {formatCurrency(saldoCaja.efectivo)}
                    </p>
                    <p className={metodoPago === 'qr' ? 'font-bold text-blue-600' : 'text-gray-400'}>
                      QR: {formatCurrency(saldoCaja.qr)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tipo de compra */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de compra</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setTipoCompra('producto'); setItems([]) }}
                    className={`py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
                      tipoCompra === 'producto' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    Productos
                  </button>
                  <button
                    onClick={() => { setTipoCompra('insumo'); setItems([]) }}
                    className={`py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
                      tipoCompra === 'insumo' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Insumos
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {tipoCompra === 'producto' 
                    ? 'Productos actualizan el stock automáticamente' 
                    : 'Insumos no afectan el inventario'}
                </p>
              </div>

              {/* Proveedor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor (opcional)</label>
                <select
                  value={proveedorId}
                  onChange={e => setProveedorId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-white"
                >
                  <option value="">Sin proveedor</option>
                  {proveedores.map(prov => (
                    <option key={prov.id} value={prov.id}>{prov.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Agregar items */}
              <div className="border border-gray-200 rounded-xl p-4">
                <h3 className="font-medium text-gray-900 mb-3">Agregar item</h3>
                
                {tipoCompra === 'producto' ? (
                  <div className="space-y-2">
                    <select
                      value={productoSeleccionado}
                      onChange={e => {
                        setProductoSeleccionado(e.target.value)
                        const prod = productos.find(p => p.id === e.target.value)
                        if (prod) setPrecioItem(prod.precio_compra.toString())
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm"
                    >
                      <option value="">Seleccionar producto...</option>
                      {productos.map(prod => (
                        <option key={prod.id} value={prod.id}>
                          {prod.nombre} (Stock: {prod.stock_actual})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={descripcionItem}
                      onChange={e => setDescripcionItem(e.target.value)}
                      placeholder="Descripción del insumo..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <input
                    type="number"
                    value={cantidadItem}
                    onChange={e => setCantidadItem(e.target.value)}
                    placeholder="Cantidad"
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    min="1"
                  />
                  <input
                    type="number"
                    value={precioItem}
                    onChange={e => setPrecioItem(e.target.value)}
                    placeholder="Precio unit."
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    step="0.01"
                    min="0"
                  />
                </div>

                <button
                  onClick={agregarItem}
                  className="w-full mt-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Agregar
                </button>
              </div>

              {/* Lista de items */}
              {items.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-900">Items ({items.length})</h3>
                  {items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-900">
                          {item.producto_nombre || item.descripcion}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.cantidad} x {formatCurrency(item.precio_unitario)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{formatCurrency(item.subtotal)}</span>
                        <button
                          onClick={() => eliminarItem(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total:</span>
                    <span className={totalCarrito > saldoDisponible ? 'text-red-600' : 'text-gray-900'}>
                      {formatCurrency(totalCarrito)}
                      {totalCarrito > saldoDisponible && (
                        <span className="text-xs font-normal ml-2">(excede saldo)</span>
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Método de pago */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Método de pago</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMetodoPago('efectivo')}
                    className={`py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
                      metodoPago === 'efectivo' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Efectivo
                  </button>
                  <button
                    onClick={() => setMetodoPago('qr')}
                    className={`py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
                      metodoPago === 'qr' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    QR
                  </button>
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl resize-none"
                  rows={2}
                  placeholder="Observaciones..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowNuevaCompra(false)}
                className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={guardarCompra}
                disabled={guardando || items.length === 0 || totalCarrito > saldoDisponible}
                className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-xl font-medium disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : `Guardar ${formatCurrency(totalCarrito)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle compra */}
      {compraSeleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Compra #{compraSeleccionada.numero_compra}</h2>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
                    compraSeleccionada.tipo === 'producto' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {compraSeleccionada.tipo === 'producto' ? 'Productos' : 'Insumos'}
                  </span>
                </div>
                <button onClick={() => setCompraSeleccionada(null)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Fecha</span>
                  <p className="font-medium">{formatDateTime(compraSeleccionada.created_at)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Método de pago</span>
                  <p className="font-medium flex items-center gap-1">
                    {compraSeleccionada.metodo_pago === 'efectivo' ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Efectivo
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        QR
                      </>
                    )}
                  </p>
                </div>
                {compraSeleccionada.proveedor_nombre && (
                  <div>
                    <span className="text-gray-500">Proveedor</span>
                    <p className="font-medium">{compraSeleccionada.proveedor_nombre}</p>
                  </div>
                )}
                <div>
                  <span className="text-gray-500">Registrado por</span>
                  <p className="font-medium">{compraSeleccionada.usuario_nombre}</p>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h3 className="font-medium text-gray-900 mb-3">Items ({compraSeleccionada.detalles.length})</h3>
                <div className="space-y-2">
                  {compraSeleccionada.detalles.map(detalle => (
                    <div key={detalle.id} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{detalle.producto_nombre || detalle.descripcion}</p>
                        <p className="text-xs text-gray-500">
                          {detalle.cantidad} x {formatCurrency(detalle.precio_unitario)}
                        </p>
                      </div>
                      <p className="font-medium text-gray-900">{formatCurrency(detalle.subtotal)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between font-bold text-lg pt-4 border-t border-gray-100">
                <span>Total</span>
                <span className="text-red-600">{formatCurrency(compraSeleccionada.total)}</span>
              </div>

              {compraSeleccionada.notas && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700"><strong>Notas:</strong> {compraSeleccionada.notas}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100">
              <button
                onClick={() => setCompraSeleccionada(null)}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes bounce-in {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-bounce-in {
          animation: bounce-in 0.4s ease-out;
        }
      `}</style>
    </div>
  )
}