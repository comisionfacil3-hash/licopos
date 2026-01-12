// Path: app\dashboard\compras\page.tsx
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
  estado?: string
  motivo_anulacion?: string | null
  anulada_por?: string | null
  anulada_at?: string | null
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
  const [pagoFueraCaja, setPagoFueraCaja] = useState(false)
  
  // Estados para agregar item
  const [productoSeleccionado, setProductoSeleccionado] = useState('')
  const [descripcionItem, setDescripcionItem] = useState('')
  const [cantidadItem, setCantidadItem] = useState('')
  const [precioItem, setPrecioItem] = useState('')
  
  // Estado para éxito
  const [showExito, setShowExito] = useState(false)
  const [compraExitosa, setCompraExitosa] = useState<number | null>(null)

  // 🆕 Estados para anulación
  const [showAnular, setShowAnular] = useState(false)
  const [motivoAnulacion, setMotivoAnulacion] = useState('')
  const [procesandoAnulacion, setProcesandoAnulacion] = useState(false)
  const [showExitoAnulacion, setShowExitoAnulacion] = useState(false)

  const { usuario } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (usuario?.sucursal_id) {
      loadData()
    }
  }, [usuario?.sucursal_id, filtroFecha, filtroTipo])

  const loadData = async () => {
    if (!usuario?.sucursal_id) return
    
    try {
      setLoading(compras.length === 0)

      // Verificar caja abierta
      const { data: cajaData } = await supabase
        .from('cajas')
        .select('id')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('estado', 'abierta')
        .maybeSingle()

      if (cajaData) {
        setCajaAbierta(true)
        setCajaId(cajaData.id)

        // Calcular saldo en caja
        const { data: movimientos } = await supabase
          .from('movimientos_caja')
          .select('*')
          .eq('caja_id', cajaData.id)
          .order('created_at', { ascending: true })

        let saldoEfectivo = 0
        let saldoQR = 0

        if (movimientos) {
          movimientos.forEach(mov => {
            if (mov.metodo_pago === 'efectivo') {
              if (mov.tipo === 'ingreso' || mov.tipo === 'apertura') {
                saldoEfectivo += mov.monto
              } else if (mov.tipo === 'egreso' || mov.tipo === 'retiro') {
                saldoEfectivo -= mov.monto
              }
            } else if (mov.metodo_pago === 'qr') {
              if (mov.tipo === 'ingreso' || mov.tipo === 'apertura') {
                saldoQR += mov.monto
              } else if (mov.tipo === 'egreso') {
                saldoQR -= mov.monto
              }
            }
          })
        }

        setSaldoCaja({ efectivo: saldoEfectivo, qr: saldoQR })
      } else {
        setCajaAbierta(false)
        setCajaId(null)
        setSaldoCaja({ efectivo: 0, qr: 0 })
      }

      // Cargar productos
      const { data: productosData } = await supabase
        .from('productos')
        .select('id, nombre, codigo, precio_compra, precio_venta, stock_actual')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('activo', true)
        .order('nombre')

      setProductos(productosData || [])

      // Cargar proveedores
      const { data: proveedoresData } = await supabase
        .from('proveedores')
        .select('id, nombre')
        .eq('sucursal_id', usuario.sucursal_id)
        .eq('activo', true)
        .order('nombre')

      setProveedores(proveedoresData || [])

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
        const proveedorIds = [...new Set(comprasData.map(c => c.proveedor_id).filter(Boolean))]
        const usuarioIds = [...new Set(comprasData.map(c => c.usuario_id))]
        const compraIds = comprasData.map(c => c.id)

        let proveedoresMap: Record<string, string> = {}
        let usuariosMap: Record<string, string> = {}

        if (proveedorIds.length > 0) {
          const { data: provData } = await supabase
            .from('proveedores')
            .select('id, nombre')
            .in('id', proveedorIds)
          if (provData) {
            provData.forEach(p => { proveedoresMap[p.id] = p.nombre })
          }
        }

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

        const { data: productosRelacionados } = await supabase
          .from('productos')
          .select('id, nombre')
          .in('id', detallesData?.filter(d => d.producto_id).map(d => d.producto_id) || [])

        const productosMap: Record<string, string> = {}
        productosRelacionados?.forEach(p => { productosMap[p.id] = p.nombre })

        const detallesPorCompra: Record<string, CompraDetalle[]> = {}
        detallesData?.forEach(detalle => {
          if (!detallesPorCompra[detalle.compra_id]) {
            detallesPorCompra[detalle.compra_id] = []
          }
          detallesPorCompra[detalle.compra_id].push({
            id: detalle.id,
            producto_id: detalle.producto_id,
            descripcion: detalle.descripcion,
            cantidad: detalle.cantidad,
            precio_unitario: detalle.precio_unitario,
            subtotal: detalle.subtotal,
            producto_nombre: detalle.producto_id ? productosMap[detalle.producto_id] || 'Producto eliminado' : detalle.descripcion
          })
        })

        const comprasCompletas: Compra[] = comprasData.map(compra => ({
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
          detalles: detallesPorCompra[compra.id] || [],
          estado: compra.estado || 'completada',
          motivo_anulacion: compra.motivo_anulacion,
          anulada_por: compra.anulada_por,
          anulada_at: compra.anulada_at
        }))

        setCompras(comprasCompletas)
      } else {
        setCompras([])
      }

    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }

  // 🆕 Verificar si la compra es del mismo día
  const esDelMismoDia = (fechaCompra: string): boolean => {
    const ahora = new Date()
    const fecha = new Date(fechaCompra)
    
    // Comparar solo año, mes y día
    return (
      fecha.getFullYear() === ahora.getFullYear() &&
      fecha.getMonth() === ahora.getMonth() &&
      fecha.getDate() === ahora.getDate()
    )
  }

  // 🆕 Anular compra
  const anularCompra = async () => {
    if (!compraSeleccionada || !usuario) return
    if (motivoAnulacion.trim().length < 10) {
      alert('El motivo debe tener al menos 10 caracteres')
      return
    }

    setProcesandoAnulacion(true)
    
    try {
      const { data, error } = await supabase.rpc('anular_compra', {
        p_compra_id: compraSeleccionada.id,
        p_motivo: motivoAnulacion.trim(),
        p_usuario_id: usuario.id
      })

      if (error) throw error

      const resultado = data as { success: boolean; error?: string; message?: string }
      
      if (!resultado.success) {
        throw new Error(resultado.error || 'Error desconocido')
      }

      // Mostrar modal de éxito
      setShowAnular(false)
      setShowExitoAnulacion(true)
      
      // Cerrar modal de éxito y recargar después de 2 segundos
      setTimeout(() => {
        setShowExitoAnulacion(false)
        setCompraSeleccionada(null)
        setMotivoAnulacion('')
        loadData()
      }, 2000)

    } catch (error: any) {
      console.error('Error anulando compra:', error)
      alert(`Error al anular compra: ${error.message}`)
    } finally {
      setProcesandoAnulacion(false)
    }
  }

  // Filtrar compras
  const comprasFiltradas = useMemo(() => {
    if (filtroTipo === 'todos') return compras
    return compras.filter(c => c.tipo === filtroTipo)
  }, [compras, filtroTipo])

  // Totales
  const totalCompras = comprasFiltradas.filter(c => c.estado !== 'anulada').reduce((sum, c) => sum + c.total, 0)
  const totalProductos = comprasFiltradas.filter(c => c.tipo === 'producto' && c.estado !== 'anulada').reduce((sum, c) => sum + c.total, 0)
  const totalInsumos = comprasFiltradas.filter(c => c.tipo === 'insumo' && c.estado !== 'anulada').reduce((sum, c) => sum + c.total, 0)

  // Total del carrito
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
    if (!usuario?.sucursal_id || !usuario?.id) return

    if (items.length === 0) {
      setError('Agregue al menos un item')
      return
    }

    if (!pagoFueraCaja) {
      if (!cajaId) {
        setError('Debe abrir la caja primero')
        return
      }
      if (totalCarrito > saldoDisponible) {
        setError(`Saldo insuficiente. Disponible en ${metodoPago === 'efectivo' ? 'efectivo' : 'QR'}: ${formatCurrency(saldoDisponible)}`)
        return
      }
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
          caja_id: pagoFueraCaja ? null : cajaId,
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

      if (!pagoFueraCaja && cajaId) {
        await supabase.from('movimientos_caja').insert({
          caja_id: cajaId,
          tipo: 'egreso',
          concepto: `Compra #${numeroCompra} - ${tipoCompra === 'producto' ? 'Productos' : 'Insumos'}`,
          referencia_id: compra.id,
          referencia_tipo: 'compra',
          monto: totalCarrito,
          metodo_pago: metodoPago
        })
      }

      setShowNuevaCompra(false)
      setItems([])
      setProveedorId('')
      setNotas('')
      setTipoCompra('producto')
      setMetodoPago('efectivo')
      setPagoFueraCaja(false)

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
    setTipoCompra('producto')
    setProveedorId('')
    setMetodoPago('efectivo')
    setItems([])
    setNotas('')
    setError('')
    setPagoFueraCaja(false)
    setShowNuevaCompra(true)
  }

  // Exportar a Excel
  const exportarExcel = () => {
    const datos = comprasFiltradas.map(compra => ({
      'Nº': compra.numero_compra,
      'Fecha': new Date(compra.fecha_compra).toLocaleDateString('es-BO'),
      'Tipo': compra.tipo === 'producto' ? 'Productos' : 'Insumos',
      'Proveedor': compra.proveedor_nombre || 'Sin proveedor',
      'Total': compra.total,
      'Método Pago': compra.metodo_pago === 'efectivo' ? 'Efectivo' : 'QR',
      'Items': compra.detalles.length,
      'Usuario': compra.usuario_nombre,
      'Estado': compra.estado === 'anulada' ? 'ANULADA' : 'Completada'
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(datos)

    ws['!cols'] = [
      { wch: 8 },
      { wch: 12 },
      { wch: 12 },
      { wch: 20 },
      { wch: 12 },
      { wch: 12 },
      { wch: 8 },
      { wch: 18 },
      { wch: 12 }
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Compras')

    const fecha = new Date().toISOString().split('T')[0]
    XLSX.writeFile(wb, `compras_${fecha}.xlsx`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando compras...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compras</h1>
          <p className="text-gray-500 text-sm">Registro de compras y suministros</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportarExcel}
            disabled={comprasFiltradas.length === 0}
            className="px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Excel
          </button>
          <button
            onClick={abrirNuevaCompra}
            className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva Compra
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
          <div className="flex gap-2">
            {(['hoy', 'semanal', 'mensual'] as const).map(periodo => (
              <button
                key={periodo}
                onClick={() => setFiltroFecha(periodo)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  filtroFecha === periodo
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {periodo === 'hoy' && 'Hoy'}
                {periodo === 'semanal' && 'Última Semana'}
                {periodo === 'mensual' && 'Este Mes'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
          <div className="flex gap-2">
            {(['todos', 'producto', 'insumo'] as const).map(tipo => (
              <button
                key={tipo}
                onClick={() => setFiltroTipo(tipo)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  filtroTipo === tipo
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tipo === 'todos' && 'Todos'}
                {tipo === 'producto' && 'Productos'}
                {tipo === 'insumo' && 'Insumos'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-gray-500 text-sm">Total Compras</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalCompras)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-gray-500 text-sm">Productos</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalProductos)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-gray-500 text-sm">Insumos</p>
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalInsumos)}</p>
        </div>
      </div>

      {/* Lista de compras */}
      {comprasFiltradas.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          <p className="text-gray-500">No hay compras en este período</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comprasFiltradas.map(compra => (
            <div
              key={compra.id}
              onClick={() => setCompraSeleccionada(compra)}
              className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${
                compra.estado === 'anulada'
                  ? 'border-red-200 bg-red-50/50'
                  : 'border-gray-200 hover:border-blue-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    compra.estado === 'anulada' ? 'bg-red-100' : 'bg-blue-100'
                  }`}>
                    {compra.estado === 'anulada' ? (
                      <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Compra #{compra.numero_compra}</h3>
                    <p className="text-xs text-gray-500">{formatDateTime(compra.created_at)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xl font-bold ${
                    compra.estado === 'anulada' ? 'text-red-600 line-through' : 'text-blue-600'
                  }`}>
                    {formatCurrency(compra.total)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {compra.tipo === 'producto' ? 'Productos' : 'Insumos'} • {compra.metodo_pago.toUpperCase()}
                  </p>
                </div>
              </div>

              {compra.proveedor_nombre && (
                <div className="mt-2 text-sm text-gray-600">
                  Proveedor: {compra.proveedor_nombre}
                </div>
              )}

              {compra.estado === 'anulada' && (
                <div className="mt-2 pt-2 border-t border-red-200">
                  <p className="text-xs text-red-600 font-medium">⚠️ COMPRA ANULADA</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Nueva Compra */}
      {showNuevaCompra && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-900">Nueva Compra</h2>
              <button onClick={() => setShowNuevaCompra(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Mensaje de error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              {/* Tipo de compra */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Compra</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTipoCompra('producto')}
                    className={`px-4 py-3 rounded-xl font-medium border-2 ${
                      tipoCompra === 'producto'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600'
                    }`}
                  >
                    📦 Productos
                  </button>
                  <button
                    onClick={() => setTipoCompra('insumo')}
                    className={`px-4 py-3 rounded-xl font-medium border-2 ${
                      tipoCompra === 'insumo'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600'
                    }`}
                  >
                    🛠️ Insumos
                  </button>
                </div>
              </div>

              {/* Proveedor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor (opcional)</label>
                <select
                  value={proveedorId}
                  onChange={e => setProveedorId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Sin proveedor</option>
                  {proveedores.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Método de pago y checkbox fuera de caja */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Método de Pago</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMetodoPago('efectivo')}
                    className={`px-4 py-2.5 rounded-lg font-medium border ${
                      metodoPago === 'efectivo'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600'
                    }`}
                  >
                    💵 Efectivo
                    {!pagoFueraCaja && cajaAbierta && (
                      <span className="block text-xs mt-1">
                        Disponible: {formatCurrency(saldoCaja.efectivo)}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setMetodoPago('qr')}
                    className={`px-4 py-2.5 rounded-lg font-medium border ${
                      metodoPago === 'qr'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600'
                    }`}
                  >
                    📱 QR
                    {!pagoFueraCaja && cajaAbierta && (
                      <span className="block text-xs mt-1">
                        Disponible: {formatCurrency(saldoCaja.qr)}
                      </span>
                    )}
                  </button>
                </div>
                
                {/* Checkbox pago fuera de caja */}
                <label className="flex items-center gap-2 mt-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pagoFueraCaja}
                    onChange={e => setPagoFueraCaja(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    Pago realizado fuera de caja (no registrar en movimientos)
                  </span>
                </label>
              </div>

              {/* Agregar item */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <h3 className="font-medium text-gray-900">Agregar Item</h3>
                
                {tipoCompra === 'producto' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Producto</label>
                    <select
                      value={productoSeleccionado}
                      onChange={e => {
                        const prodId = e.target.value
                        setProductoSeleccionado(prodId)
                        const prod = productos.find(p => p.id === prodId)
                        if (prod) {
                          setPrecioItem(prod.precio_compra.toString())
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    >
                      <option value="">Seleccionar producto</option>
                      {productos.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} - Stock: {p.stock_actual}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                    <input
                      type="text"
                      value={descripcionItem}
                      onChange={e => setDescripcionItem(e.target.value)}
                      placeholder="Ej: Bolsas plásticas, Servilletas..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value={cantidadItem}
                      onChange={e => setCantidadItem(e.target.value)}
                      placeholder="Cantidad"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Precio c/u</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={precioItem}
                      onChange={e => setPrecioItem(e.target.value)}
                      placeholder="Precio"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <button
                  onClick={agregarItem}
                  className="w-full py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Agregar
                </button>
              </div>

              {/* Items agregados */}
              {items.length > 0 && (
                <div className="border border-gray-200 rounded-xl p-4">
                  <h3 className="font-medium text-gray-900 mb-3">Items ({items.length})</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {items.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm text-gray-900">
                            {item.producto_nombre || item.descripcion}
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.cantidad} x {formatCurrency(item.precio_unitario)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{formatCurrency(item.subtotal)}</span>
                          <button
                            onClick={() => eliminarItem(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                    <span className="font-bold text-gray-900">Total:</span>
                    <span className="text-xl font-bold text-blue-600">{formatCurrency(totalCarrito)}</span>
                  </div>
                </div>
              )}

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  placeholder="Observaciones adicionales..."
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl resize-none"
                />
              </div>

              {/* Botón guardar */}
              <button
                onClick={guardarCompra}
                disabled={guardando || items.length === 0}
                className={`w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 ${
                  guardando || items.length === 0
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {guardando ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Guardar Compra
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle Compra */}
      {compraSeleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Compra #{compraSeleccionada.numero_compra}</h2>
                  <p className="text-sm text-gray-500 mt-1">{formatDateTime(compraSeleccionada.created_at)}</p>
                </div>
                <button onClick={() => setCompraSeleccionada(null)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Información general */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Tipo:</span>
                  <span className="font-medium text-gray-900">
                    {compraSeleccionada.tipo === 'producto' ? 'Productos' : 'Insumos'}
                  </span>
                </div>
                {compraSeleccionada.proveedor_nombre && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Proveedor:</span>
                    <span className="font-medium text-gray-900">{compraSeleccionada.proveedor_nombre}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Método de pago:</span>
                  <span className="font-medium text-gray-900">
                    {compraSeleccionada.metodo_pago === 'efectivo' ? 'Efectivo' : 'QR'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Usuario:</span>
                  <span className="font-medium text-gray-900">{compraSeleccionada.usuario_nombre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Estado:</span>
                  <span className={`font-medium ${compraSeleccionada.estado === 'anulada' ? 'text-red-600' : 'text-emerald-600'}`}>
                    {compraSeleccionada.estado === 'anulada' ? '❌ Anulada' : '✓ Completada'}
                  </span>
                </div>
              </div>

              {/* Detalle de items */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">Items</h3>
                <div className="space-y-2">
                  {compraSeleccionada.detalles.map(detalle => (
                    <div key={detalle.id} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{detalle.producto_nombre}</p>
                        <p className="text-sm text-gray-500">
                          {detalle.cantidad} x {formatCurrency(detalle.precio_unitario)}
                        </p>
                      </div>
                      <span className="font-bold text-gray-900">{formatCurrency(detalle.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="border-t border-gray-200 pt-4 flex justify-between items-center">
                <span className="text-lg font-bold text-gray-900">Total:</span>
                <span className={`text-2xl font-bold ${
                  compraSeleccionada.estado === 'anulada' ? 'text-red-600 line-through' : 'text-blue-600'
                }`}>
                  {formatCurrency(compraSeleccionada.total)}
                </span>
              </div>

              {/* Notas */}
              {compraSeleccionada.notas && (
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Notas:</h3>
                  <p className="text-gray-700 text-sm bg-gray-50 p-3 rounded-lg">{compraSeleccionada.notas}</p>
                </div>
              )}

              {/* Información de anulación */}
              {compraSeleccionada.estado === 'anulada' && (
                <div className="border-t border-red-200 pt-4">
                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <p className="text-red-700 text-sm font-bold mb-2">⚠️ Esta compra fue anulada</p>
                    {compraSeleccionada.motivo_anulacion && (
                      <p className="text-red-600 text-sm">
                        <strong>Motivo:</strong> {compraSeleccionada.motivo_anulacion}
                      </p>
                    )}
                    {compraSeleccionada.anulada_at && (
                      <p className="text-red-500 text-xs mt-1">
                        {formatDateTime(compraSeleccionada.anulada_at)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Botón Anular - Solo si es gerente/admin, no está anulada y es del mismo día */}
              {(usuario?.rol === 'gerente' || usuario?.rol === 'admin') &&
               compraSeleccionada.estado !== 'anulada' &&
               esDelMismoDia(compraSeleccionada.created_at) && (
                <div className="border-t border-gray-200 pt-4">
                  <button
                    onClick={() => setShowAnular(true)}
                    className="w-full px-4 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 font-medium"
                  >
                    ❌ Anular Compra
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación anulación */}
      {showAnular && compraSeleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl w-full max-w-md animate-bounce-in">
            <div className="p-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
                ¿Anular Compra #{compraSeleccionada.numero_compra}?
              </h3>
              <p className="text-gray-500 text-center text-sm mb-4">
                Esta acción devolverá el stock y revertirá el movimiento de caja
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo de anulación (mínimo 10 caracteres) *
                </label>
                <textarea
                  value={motivoAnulacion}
                  onChange={(e) => setMotivoAnulacion(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none resize-none"
                  rows={3}
                  placeholder="Ejemplo: Error en cantidad, proveedor canceló entrega, etc."
                  disabled={procesandoAnulacion}
                />
                <p className="text-xs text-gray-400 mt-1">
                  {motivoAnulacion.length}/10 caracteres mínimos
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAnular(false)
                    setMotivoAnulacion('')
                  }}
                  disabled={procesandoAnulacion}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={anularCompra}
                  disabled={procesandoAnulacion || motivoAnulacion.trim().length < 10}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {procesandoAnulacion ? 'Anulando...' : 'Confirmar Anulación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de éxito anulación */}
      {showExitoAnulacion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full animate-bounce-in">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Compra Anulada!</h2>
            <p className="text-gray-500">Stock devuelto y movimientos revertidos correctamente</p>
          </div>
        </div>
      )}

      {/* Modal Éxito */}
      {showExito && compraExitosa && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center animate-bounce-in">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">¡Compra registrada!</h3>
            <p className="text-gray-600">Compra #{compraExitosa}</p>
            <p className="text-sm text-gray-500 mt-2">
              {pagoFueraCaja ? 'Registrada fuera de caja' : 'Registrada en caja'}
            </p>
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