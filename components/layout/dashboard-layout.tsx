'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [showMore, setShowMore] = useState(false)
  const [sucursalNombre, setSucursalNombre] = useState('Sucursal')
  const { usuario, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  // Obtener nombre de sucursal
  useEffect(() => {
    const fetchSucursal = async () => {
      if (usuario?.sucursal_id) {
        try {
          const { data, error } = await supabase
            .from('sucursales')
            .select('nombre')
            .eq('id', usuario.sucursal_id)
            .single()

          if (data && !error) {
            setSucursalNombre(data.nombre)
          }
        } catch (error) {
          console.error('Error fetching sucursal:', error)
        }
      }
    }

    fetchSucursal()
  }, [usuario?.sucursal_id, supabase])

  // Módulos principales en bottom nav
  const mainNavigation = [
    { name: 'Inicio', href: '/dashboard', icon: 'home' },
    { name: 'Productos', href: '/dashboard/productos', icon: 'package' },
    { name: 'Ventas', href: '/dashboard/pos', icon: 'shopping-cart' },
    { name: 'Caja', href: '/dashboard/caja', icon: 'cash' },
    { name: 'Más', href: '#', icon: 'dots', action: () => setShowMore(true) },
  ]

  // Módulos secundarios en modal "Más"
  const moreModules = [
    { name: 'Historial de Ventas', href: '/dashboard/ventas', icon: 'list' },
    { name: 'Reportes', href: '/dashboard/reportes', icon: 'chart' },
    { name: 'Historial Cajas', href: '/dashboard/caja/historial', icon: 'list'},
    { name: 'Proveedores', href: '/dashboard/proveedores', icon: 'building' },
    { name: 'Compras', href: '/dashboard/compras', icon: 'truck' },
    { name: 'Gastos', href: '/dashboard/gastos', icon: 'receipt' },
    { name: 'Clientes', href: '/dashboard/clientes', icon: 'users' },
    { name: 'Créditos', href: '/dashboard/creditos', icon: 'credit-card' },
    { name: 'Cotización', href: '/dashboard/cotizacion', icon: 'calculator' },
    { name: 'Bajas', href: '/dashboard/productos/perdidas', icon: '' },
    { name: 'Usuarios', href: '/dashboard/usuarios', icon: 'user-group' },
  ]

  const getIcon = (type: string, size = 'w-6 h-6') => {
    const icons = {
      home: (
        <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      'shopping-cart': (
        <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l-2.5-5m0 0l-1.5-3" />
        </svg>
      ),
      package: (
        <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      cash: (
        <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 0h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v2" />
        </svg>
      ),
      dots: (
        <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
      ),
      list: (
        <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      ),
      truck: (
        <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4H6a2 2 0 00-2 2v6a2 2 0 002 2h2m0 0h8m-8 0v4a2 2 0 002 2h4a2 2 0 002-2V8a2 2 0 00-2-2h-2m-8 6V6a2 2 0 012-2h6a2 2 0 012 2v6m-6 10h4a2 2 0 002-2v-4a2 2 0 00-2-2h-4a2 2 0 00-2 2v4a2 2 0 002 2z" />
        </svg>
      ),
      receipt: (
        <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      'credit-card': (
        <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
      users: (
        <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
      building: (
        <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      calculator: (
        <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
      chart: (
        <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      'user-group': (
        <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    }
    return icons[type as keyof typeof icons] || icons.home
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const handleNavigation = (item: any) => {
    if (item.action) {
      item.action()
    } else {
      router.push(item.href)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">LicoPos</h1>
              <p className="text-xs text-gray-500">{sucursalNombre}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{usuario?.nombre}</p>
              <p className="text-xs text-gray-500 capitalize">{usuario?.rol}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 text-gray-400 hover:text-red-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 overflow-auto pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="grid grid-cols-5 py-2">
          {mainNavigation.map((item) => {
            const isActive = pathname === item.href
            const isVentas = item.name === 'Ventas'
            
            return (
              <button
                key={item.name}
                onClick={() => handleNavigation(item)}
                className={`
                  flex flex-col items-center justify-center py-2 px-2 transition-all duration-200
                  ${isActive 
                    ? 'text-primary-600' 
                    : 'text-gray-500 hover:text-primary-600'
                  }
                `}
              >
                <div className={`
                  p-1.5 transition-all duration-200
                  ${isVentas 
                    ? 'bg-green-500 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:bg-green-600 hover:scale-105' 
                    : `rounded-lg ${isActive ? 'bg-primary-50' : ''}`
                  }
                `}>
                  {getIcon(item.icon, 'w-6 h-6')}
                </div>
                <span className="text-xs font-medium mt-1">{item.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Modal "Más" */}
      {showMore && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-end">
          <div className="w-full bg-white rounded-t-2xl max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Más Herramientas</h3>
                <button
                  onClick={() => setShowMore(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {moreModules.map((module) => (
                  <button
                    key={module.name}
                    onClick={() => {
                      router.push(module.href)
                      setShowMore(false)
                    }}
                    className="flex flex-col items-center p-2 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center mb-3">
                      <span className="text-primary-600">
                        {getIcon(module.icon)}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-gray-900 text-center">
                      {module.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}