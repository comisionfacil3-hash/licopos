// Path: app\login\page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const { signIn, user, usuario, loading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && user && usuario) {
      console.log('🚀 Redirecting user:', {
        email: usuario.email,
        rol: usuario.rol,
        sucursal_id: usuario.sucursal_id
      })

      if (usuario.rol === 'admin' && usuario.sucursal_id === null) {
        console.log('🏢 Redirecting to admin panel')
        router.replace('/admin')
      } else {
        console.log('🏪 Redirecting to dashboard')
        router.replace('/dashboard')
      }
    }
  }, [user, usuario, authLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (loading) return
    
    setLoading(true)
    setError('')
    
    console.log('🔐 Login attempt:', email)
    
    try {
      const result = await signIn(email, password)
      
      if (result.error) {
        setError(result.error)
        setLoading(false)
      }
    } catch (error) {
      console.error('❌ Login error:', error)
      setError('Error inesperado. Intente de nuevo.')
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 shadow-xl max-w-md">
          <div className="text-center">
            <div className="spinner mb-4"></div>
            <h2 className="text-lg font-medium text-gray-900">Verificando sesión...</h2>
            <p className="text-sm text-gray-500 mt-2">Por favor espere</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="card card-padding bg-white shadow-xl">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-primary-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">ControlaPos</h1>
            <p className="text-gray-600">Sistema de Gestión para Licorerías</p>
            <div className="mt-4">
              <span className="badge badge-success">Bolivia • Versión 2.0</span>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="label">Email</label>
              <input 
                type="email" 
                placeholder="Ingresa tu email" 
                className={`input ${error ? 'input-error' : ''}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>
            
            <div>
              <label className="label">Contraseña</label>
              <input 
                type="password" 
                placeholder="Ingresa tu contraseña" 
                className={`input ${error ? 'input-error' : ''}`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <p className="text-red-600 text-sm font-medium">{error}</p>
                </div>
              </div>
            )}
            
            <button 
              type="submit" 
              className="btn-primary w-full py-3 text-lg font-semibold"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner mr-2"></span>
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>
          
          <div className="mt-8 text-center">
            <p className="text-xs text-gray-500">
              © 2024 ControlaPos. Sistema profesional de gestión.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}