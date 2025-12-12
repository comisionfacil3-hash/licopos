'use client'

import { useAuth } from '@/lib/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'admin' | 'gerente' | 'vendedor'
  requireSucursal?: boolean
}

export default function ProtectedRoute({ 
  children, 
  requiredRole,
  requireSucursal = true 
}: ProtectedRouteProps) {
  const { user, usuario, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      // Si no está autenticado
      if (!user || !usuario) {
        router.push('/login')
        return
      }

      // Si el usuario no está activo
      if (!usuario.activo) {
        router.push('/sistema-pausado')
        return
      }

      // Verificar rol requerido
      if (requiredRole && usuario.rol !== requiredRole) {
        // Admin puede acceder a todo
        if (usuario.rol !== 'admin') {
          router.push('/dashboard')
          return
        }
      }

      // Verificar si requiere sucursal
      if (requireSucursal && !usuario.sucursal_id && usuario.rol !== 'admin') {
        router.push('/sistema-pausado')
        return
      }
    }
  }, [user, usuario, loading, requiredRole, requireSucursal, router])

  // Mostrar loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mb-4"></div>
          <h2 className="text-lg font-medium text-gray-900">Cargando...</h2>
          <p className="text-gray-600">Verificando permisos</p>
        </div>
      </div>
    )
  }

  // Si no está autenticado, no mostrar nada (ya está redirigiendo)
  if (!user || !usuario || !usuario.activo) {
    return null
  }

  return <>{children}</>
}