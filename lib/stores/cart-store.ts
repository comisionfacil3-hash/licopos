// Path: lib\stores\cart-store.ts
// lib/stores/cart-store.ts
// LICOPOS v2.1 - Store del Carrito de Compras
// Usa Zustand para manejo de estado global

import { create } from 'zustand'
import { Producto, ItemCarrito } from '@/types/database'

interface CartState {
  // Estado
  items: ItemCarrito[]
  descuento: number
  
  // Getters calculados
  getSubtotal: () => number
  getTotal: () => number
  getItemCount: () => number
  
  // Acciones
  addItem: (producto: Producto, cantidad?: number) => void
  removeItem: (productoId: string) => void
  updateQuantity: (productoId: string, cantidad: number) => void
  updatePrice: (productoId: string, nuevoPrecio: number) => void
  setDescuento: (descuento: number) => void
  clearCart: () => void
  
  // Validaciones
  canAddItem: (producto: Producto, cantidad: number) => { valid: boolean; message?: string }
}

export const useCartStore = create<CartState>((set, get) => ({
  // Estado inicial
  items: [],
  descuento: 0,
  
  // Getter: Calcular subtotal
  getSubtotal: () => {
    return get().items.reduce((sum, item) => sum + item.subtotal, 0)
  },
  
  // Getter: Calcular total con descuento
  getTotal: () => {
    const subtotal = get().getSubtotal()
    const descuento = get().descuento
    return Math.max(0, subtotal - descuento)
  },
  
  // Getter: Cantidad de items
  getItemCount: () => {
    return get().items.reduce((sum, item) => sum + item.cantidad, 0)
  },
  
  // Validar si se puede agregar un producto
  canAddItem: (producto: Producto, cantidad: number) => {
    if (!producto.activo) {
      return { valid: false, message: 'Producto no disponible' }
    }
    
    // Buscar si ya existe en el carrito
    const existingItem = get().items.find(item => item.producto.id === producto.id)
    const cantidadActual = existingItem ? existingItem.cantidad : 0
    const cantidadTotal = cantidadActual + cantidad
    
    if (cantidadTotal > producto.stock_actual) {
      return { 
        valid: false, 
        message: `Stock insuficiente. Disponible: ${producto.stock_actual - cantidadActual}` 
      }
    }
    
    return { valid: true }
  },
  
  // Agregar producto al carrito
  addItem: (producto: Producto, cantidad = 1) => {
    set((state) => {
      const existingIndex = state.items.findIndex(
        item => item.producto.id === producto.id
      )
      
      if (existingIndex >= 0) {
        // Ya existe, incrementar cantidad
        const newItems = [...state.items]
        const newCantidad = newItems[existingIndex].cantidad + cantidad
        
        // Validar stock
        if (newCantidad > producto.stock_actual) {
          return state // No hacer nada si excede stock
        }
        
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          cantidad: newCantidad,
          subtotal: newCantidad * newItems[existingIndex].precio_unitario
        }
        
        return { items: newItems }
      } else {
        // Nuevo producto
        if (cantidad > producto.stock_actual) {
          return state // No hacer nada si excede stock
        }
        
        const newItem: ItemCarrito = {
          producto,
          cantidad,
          precio_unitario: producto.precio_venta,
          precio_original: producto.precio_venta,
          subtotal: cantidad * producto.precio_venta
        }
        
        return { items: [...state.items, newItem] }
      }
    })
  },
  
  // Eliminar producto del carrito
  removeItem: (productoId: string) => {
    set((state) => ({
      items: state.items.filter(item => item.producto.id !== productoId)
    }))
  },
  
  // Actualizar cantidad de un producto
  updateQuantity: (productoId: string, cantidad: number) => {
    set((state) => {
      if (cantidad <= 0) {
        // Si cantidad es 0 o menos, eliminar
        return { items: state.items.filter(item => item.producto.id !== productoId) }
      }
      
      const newItems = state.items.map(item => {
        if (item.producto.id === productoId) {
          // Validar stock
          const cantidadFinal = Math.min(cantidad, item.producto.stock_actual)
          return {
            ...item,
            cantidad: cantidadFinal,
            subtotal: cantidadFinal * item.precio_unitario
          }
        }
        return item
      })
      
      return { items: newItems }
    })
  },
  
  // Actualizar precio de un producto (para edición de precio)
  updatePrice: (productoId: string, nuevoPrecio: number) => {
    set((state) => ({
      items: state.items.map(item => {
        if (item.producto.id === productoId) {
          return {
            ...item,
            precio_unitario: nuevoPrecio,
            subtotal: item.cantidad * nuevoPrecio
          }
        }
        return item
      })
    }))
  },
  
  // Establecer descuento global
  setDescuento: (descuento: number) => {
    set({ descuento: Math.max(0, descuento) })
  },
  
  // Limpiar carrito completamente
  clearCart: () => {
    set({ items: [], descuento: 0 })
  }
}))

// Hook helper para obtener el carrito formateado
export function useCart() {
  const store = useCartStore()
  
  return {
    items: store.items,
    descuento: store.descuento,
    subtotal: store.getSubtotal(),
    total: store.getTotal(),
    itemCount: store.getItemCount(),
    isEmpty: store.items.length === 0,
    
    // Acciones
    addItem: store.addItem,
    removeItem: store.removeItem,
    updateQuantity: store.updateQuantity,
    updatePrice: store.updatePrice,
    setDescuento: store.setDescuento,
    clearCart: store.clearCart,
    canAddItem: store.canAddItem
  }
}