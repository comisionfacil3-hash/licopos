// =====================================================
// RUTAS DEL SISTEMA ControlaPos v2.1
// =====================================================

// Rutas públicas (sin autenticación)
export const PUBLIC_ROUTES = [
  '/login',
  '/sistema-pausado'
] as const

// Rutas protegidas por rol
export const ADMIN_ROUTES = [
  '/admin',
  '/admin/empresas',           // ✅ Agregada (ya implementada)
  '/admin/sucursales',         // ✅ Agregada (ya implementada)  
  '/admin/usuarios',           // ✅ Agregada (ya implementada)
  '/admin/categorias',         // ⏳ Pendiente
  '/admin/traspasos',          // ⏳ Pendiente
  '/admin/reportes',           // ⏳ Pendiente
  '/admin/auditoria'           // ⏳ Pendiente
] as const

export const DASHBOARD_ROUTES = [
  '/dashboard',

  // POS (Punto de Venta)
  '/dashboard/pos',

  // Productos - ✅ IMPLEMENTADAS AHORA
  '/dashboard/productos',
  '/dashboard/productos/nuevo',
  '/dashboard/productos/perdidas',
  '/dashboard/productos/[id]',     // Ruta dinámica para editar

  // Ventas
  '/dashboard/ventas',
  '/dashboard/ventas/[id]',

  // Compras  
  '/dashboard/compras',
  '/dashboard/compras/nueva',

  // Gastos
  '/dashboard/gastos', 
  '/dashboard/gastos/nuevo',

  // Caja
  '/dashboard/caja',
  '/dashboard/caja/historial',

  // Créditos
  '/dashboard/creditos',
  '/dashboard/creditos/[id]',

  // Clientes
  '/dashboard/clientes',
  '/dashboard/clientes/[id]',

  // Proveedores
  '/dashboard/proveedores', 
  '/dashboard/proveedores/[id]',

  // Otras funcionalidades
  '/dashboard/cotizacion',
  '/dashboard/usuarios',
  '/dashboard/reportes'
] as const

// =====================================================
// RUTAS ORGANIZADAS POR MÓDULO (Para fácil referencia)
// =====================================================

export const ROUTES = {
  // Públicas
  PUBLIC: {
    LOGIN: '/login',
    SISTEMA_PAUSADO: '/sistema-pausado'
  },

  // Panel Admin
  ADMIN: {
    HOME: '/admin',
    EMPRESAS: '/admin/empresas',
    SUCURSALES: '/admin/sucursales', 
    USUARIOS: '/admin/usuarios',
    CATEGORIAS: '/admin/categorias',
    TRASPASOS: '/admin/traspasos',
    REPORTES: '/admin/reportes',
    AUDITORIA: '/admin/auditoria'
  },

  // Dashboard Sucursal
  DASHBOARD: {
    HOME: '/dashboard',
    
    // POS
    POS: '/dashboard/pos',
    
    // Productos ✅ NUEVAS RUTAS AGREGADAS
    PRODUCTOS: {
      HOME: '/dashboard/productos',
      NUEVO: '/dashboard/productos/nuevo', 
      EDITAR: (id: string) => `/dashboard/productos/${id}`,
      PERDIDAS: '/dashboard/productos/perdidas'
    },
    
    // Ventas
    VENTAS: {
      HOME: '/dashboard/ventas',
      DETALLE: (id: string) => `/dashboard/ventas/${id}`
    },
    
    // Compras
    COMPRAS: {
      HOME: '/dashboard/compras',
      NUEVA: '/dashboard/compras/nueva'
    },
    
    // Gastos  
    GASTOS: {
      HOME: '/dashboard/gastos',
      NUEVO: '/dashboard/gastos/nuevo'
    },
    
    // Caja
    CAJA: {
      HOME: '/dashboard/caja',
      HISTORIAL: '/dashboard/caja/historial'
    },
    
    // Créditos
    CREDITOS: {
      HOME: '/dashboard/creditos',
      DETALLE: (id: string) => `/dashboard/creditos/${id}`
    },
    
    // Clientes
    CLIENTES: {
      HOME: '/dashboard/clientes',
      DETALLE: (id: string) => `/dashboard/clientes/${id}`
    },
    
    // Proveedores
    PROVEEDORES: {
      HOME: '/dashboard/proveedores',
      DETALLE: (id: string) => `/dashboard/proveedores/${id}` 
    },
    
    // Otros
    COTIZACION: '/dashboard/cotizacion',
    USUARIOS: '/dashboard/usuarios',
    REPORTES: '/dashboard/reportes'
  }
} as const

// =====================================================
// UTILIDADES PARA NAVEGACIÓN
// =====================================================

// Verificar si una ruta es pública
export function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.includes(path as any)
}

// Verificar si una ruta requiere rol admin
export function isAdminRoute(path: string): boolean {
  return ADMIN_ROUTES.some(route => path.startsWith(route))
}

// Verificar si una ruta requiere sucursal
export function isDashboardRoute(path: string): boolean {
  return DASHBOARD_ROUTES.some(route => {
    // Manejar rutas dinámicas como /dashboard/productos/[id]
    if (route.includes('[id]')) {
      const baseRoute = route.replace('/[id]', '')
      return path.startsWith(baseRoute) && path !== baseRoute
    }
    return path === route || path.startsWith(route + '/')
  })
}

// Obtener ruta de redirección por rol
export function getDefaultRouteForRole(rol: string, sucursalId?: string): string {
  if (rol === 'admin' && !sucursalId) {
    return ROUTES.ADMIN.HOME
  }
  return ROUTES.DASHBOARD.HOME
}

// =====================================================
// TIPOS DE TYPESCRIPT PARA AUTOCOMPLETADO
// =====================================================

export type PublicRoute = typeof PUBLIC_ROUTES[number]
export type AdminRoute = typeof ADMIN_ROUTES[number] 
export type DashboardRoute = typeof DASHBOARD_ROUTES[number]