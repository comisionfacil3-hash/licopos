// Tipos básicos de la base de datos
export interface Empresa {
  id: string
  nombre: string
  logo_url?: string
  telefono?: string
  email?: string
  direccion?: string
  activa: boolean
  configuracion: Record<string, any>
  created_at: string
  updated_at: string
}

export interface Sucursal {
  id: string
  empresa_id: string
  nombre: string
  direccion?: string
  telefono?: string
  logo_url?: string
  activa: boolean
  created_at: string
  updated_at: string
}

export interface Usuario {
  id: string
  auth_id?: string
  empresa_id: string
  sucursal_id?: string
  email: string
  nombre: string
  telefono?: string
  rol: 'admin' | 'gerente' | 'vendedor'
  activo: boolean
  permisos: Record<string, any>
  ultimo_acceso?: string
  created_at: string
  updated_at: string
}

export interface Categoria {
  id: string
  empresa_id: string
  nombre: string
  descripcion?: string
  color: string
  icono: string
  orden: number
  activa: boolean
  created_at: string
  updated_at: string
}



export interface Cliente {
  id: string
  sucursal_id: string
  nombre: string
  telefono?: string
  email?: string
  direccion?: string
  nit?: string
  notas?: string
  limite_credito: number
  activo: boolean
  created_at: string
  updated_at: string
}

export interface Venta {
  id: string
  sucursal_id: string
  caja_id: string
  usuario_id: string
  cliente_id?: string
  numero_venta: number
  subtotal: number
  descuento: number
  total: number
  metodo_pago: 'efectivo' | 'qr' | 'credito' | 'mixto'
  monto_efectivo: number
  monto_qr: number
  monto_credito: number
  estado: 'completada' | 'anulada'
  motivo_anulacion?: string
  anulada_por?: string
  anulada_at?: string
  notas?: string
  created_at: string
  updated_at: string
}

export interface Caja {
  id: string
  sucursal_id: string
  usuario_id: string
  nombre: string
  monto_inicial: number
  monto_final?: number
  fecha_apertura: string
  fecha_cierre?: string
  estado: 'abierta' | 'cerrada'
  notas?: string
  created_at: string
  updated_at: string
}

export interface MovimientoCaja {
  id: string
  caja_id: string
  tipo: 'ingreso' | 'egreso' | 'apertura' | 'cierre' | 'retiro'
  concepto: string
  monto: number
  metodo_pago: 'efectivo' | 'qr' | 'tarjeta'
  referencia_tipo?: 'venta' | 'pago_credito' | 'gasto' | 'compra'
  referencia_id?: string
  created_at: string
  created_by?: string
}

export interface ResumenCaja {
  monto_inicial: number
  ventas_efectivo: number
  ventas_qr: number
  pagos_credito_efectivo: number
  pagos_credito_qr: number
  gastos_efectivo: number
  gastos_qr: number
  compras_efectivo: number
  compras_qr: number
  retiros: number
  total_efectivo: number
  total_qr: number
  total_esperado: number
}
export interface ItemCarrito {
  id?: string  // ← Agrega el ?
  producto_id?: string  // ← Agrega el ?
  producto: Producto
  cantidad: number
  precio_unitario: number
  precio_original: number
  subtotal: number
  descuento?: number
  notas?: string
}

// Tipos para respuestas de API
export type ApiResponse<T> = {
  data: T | null
  error: string | null
  success: boolean
}

// =====================================================
// NUEVOS TIPOS PARA MÓDULO DE PRODUCTOS
// =====================================================

export interface Categoria {
  id: string
  empresa_id: string
  nombre: string
  descripcion?: string
  color: string
  icono: string
  orden: number
  activa: boolean
  created_at: string
  updated_at: string
}

export interface Producto {
  id: string
  sucursal_id: string
  categoria_id?: string
  codigo?: string
  codigo_barras?: string
  nombre: string
  descripcion?: string
  marca?: string
  unidad: string
  precio_compra: number
  precio_venta: number
  stock_actual: number
  stock_minimo: number
  stock_maximo: number
  imagen_url?: string
  activo: boolean
  created_at: string
  updated_at: string
}

export interface ProductoWithCategoria extends Producto {
  categoria?: Categoria
}

export interface Perdida {
  id: string
  sucursal_id: string
  producto_id: string
  usuario_id: string
  cantidad: number
  costo_unitario: number
  costo_total: number
  motivo: string
  created_at: string
}

export interface PerdidaWithDetails extends Perdida {
  producto: Producto
  usuario: Usuario
}

// Tipos para formularios
export interface CreateProductoForm {
  categoria_id?: string
  codigo?: string
  codigo_barras?: string
  nombre: string
  descripcion?: string
  marca?: string
  unidad: string
  precio_compra: number
  precio_venta: number
  stock_actual: number
  stock_minimo: number
  stock_maximo: number
  activo: boolean
}

export interface CreatePerdidaForm {
  producto_id: string
  cantidad: number
  motivo: string
}

// Enum para estados de stock
export enum StockStatus {
  SIN_STOCK = 'sin_stock',
  STOCK_BAJO = 'stock_bajo', 
  STOCK_NORMAL = 'stock_normal',
  STOCK_ALTO = 'stock_alto'
}

// Tipo para filtros de productos
export interface ProductoFilters {
  search?: string
  categoria_id?: string
  stock_status?: StockStatus
  activo?: boolean
}