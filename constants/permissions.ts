// Path: constants\permissions.ts
// Permisos por defecto para cada rol
export const DEFAULT_PERMISSIONS = {
  admin: {
    dashboard: { ver: true },
    pos: { vender: true, editar_precio: true, aplicar_descuento: true },
    productos: { ver: true, crear: true, editar: true, registrar_perdida: true },
    ventas: { ver_propias: true, ver_todas: true, anular: true },
    caja: { ver: true, abrir: true, cerrar: true, retiros: true },
    compras: { ver: true, crear: true },
    gastos: { ver: true, crear: true },
    creditos: { ver: true, registrar_pago: true },
    clientes: { ver: true, crear: true, editar: true },
    reportes: { ver: true }
  },
  gerente: {
    dashboard: { ver: true },
    pos: { vender: true, editar_precio: true, aplicar_descuento: true },
    productos: { ver: true, crear: true, editar: true, registrar_perdida: true },
    ventas: { ver_propias: true, ver_todas: true, anular: true },
    caja: { ver: true, abrir: true, cerrar: true, retiros: true },
    compras: { ver: true, crear: true },
    gastos: { ver: true, crear: true },
    creditos: { ver: true, registrar_pago: true },
    clientes: { ver: true, crear: true, editar: true },
    reportes: { ver: true }
  },
  vendedor: {
    dashboard: { ver: true },
    pos: { vender: true, editar_precio: false, aplicar_descuento: false },
    productos: { ver: true, crear: false, editar: false, registrar_perdida: false },
    ventas: { ver_propias: true, ver_todas: false, anular: false },
    caja: { ver: true, abrir: false, cerrar: false, retiros: false },
    compras: { ver: false, crear: false },
    gastos: { ver: false, crear: false },
    creditos: { ver: false, registrar_pago: false },
    clientes: { ver: true, crear: true, editar: false },
    reportes: { ver: false }
  }
}