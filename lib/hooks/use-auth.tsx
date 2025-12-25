// Path: lib\hooks\use-auth.tsx
'use client'

import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { Usuario } from '@/types/database'

interface AuthContextType {
  user: User | null
  usuario: Usuario | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null; success?: boolean }>
  signOut: () => Promise<void>
  isAdmin: boolean
  isGerente: boolean
  isVendedor: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // Función para obtener datos del usuario de la tabla usuarios
  const fetchUsuario = async (authUser: User): Promise<Usuario | null> => {
    try {
      console.log('🔍 Fetching usuario data for auth_id:', authUser.id)
      
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('auth_id', authUser.id)
        .single()

      if (error) {
        console.error('❌ Error fetching usuario:', error)
        return null
      }

      console.log('✅ Usuario data fetched:', data)
      return data as Usuario
    } catch (error) {
      console.error('❌ Error in fetchUsuario:', error)
      return null
    }
  }

  // Función de login
  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔑 Starting login for:', email)
      setLoading(true)

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('❌ Auth error:', error)
        setLoading(false)
        return { error: error.message }
      }

      if (!data.user) {
        setLoading(false)
        return { error: 'No se pudo autenticar el usuario' }
      }

      console.log('✅ Auth successful, fetching user data...')
      
      // Obtener datos del usuario
      const usuarioData = await fetchUsuario(data.user)
      
      if (!usuarioData) {
        setLoading(false)
        await supabase.auth.signOut()
        return { error: 'Usuario no encontrado en el sistema' }
      }

      if (!usuarioData.activo) {
        setLoading(false)
        await supabase.auth.signOut()
        return { error: 'Usuario desactivado. Contacte al administrador.' }
      }

      console.log('🎉 Login successful for:', usuarioData.nombre)
      
      // Actualizar estado
      setUser(data.user)
      setUsuario(usuarioData)
      setLoading(false)
      
      return { error: null, success: true }
    } catch (error) {
      console.error('❌ Login error:', error)
      setLoading(false)
      return { error: 'Error de conexión. Intente de nuevo.' }
    }
  }

  // Función de logout
  const signOut = async () => {
    try {
      console.log('👋 Signing out...')
      await supabase.auth.signOut()
      setUser(null)
      setUsuario(null)
    } catch (error) {
      console.error('❌ Logout error:', error)
    }
  }

  // Verificación inicial de sesión (SIMPLIFICADA)
  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        console.log('🔍 Checking initial session...')
        
        // Agregar timeout para evitar que se cuelgue
        const timeoutId = setTimeout(() => {
          if (mounted) {
            console.log('⏰ Session check timeout - setting loading to false')
            setLoading(false)
          }
        }, 5000) // 5 segundos máximo

        const { data: { session }, error } = await supabase.auth.getSession()
        
        clearTimeout(timeoutId)
        
        if (error) {
          console.error('❌ Session error:', error)
          if (mounted) {
            setLoading(false)
          }
          return
        }

        if (session?.user && mounted) {
          console.log('👤 Existing session found for:', session.user.email)
          const usuarioData = await fetchUsuario(session.user)
          
          if (usuarioData && usuarioData.activo && mounted) {
            console.log('✅ User data loaded, setting state')
            setUser(session.user)
            setUsuario(usuarioData)
          } else {
            console.log('❌ Usuario not found or inactive, signing out')
            await supabase.auth.signOut()
          }
        } else {
          console.log('ℹ️ No existing session')
        }
        
        if (mounted) {
          setLoading(false)
        }
      } catch (error) {
        console.error('❌ Initialize auth error:', error)
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // Listener para cambios de estado de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event)
        
        if (!mounted) return

        if (event === 'SIGNED_OUT') {
          console.log('👋 User signed out')
          setUser(null)
          setUsuario(null)
          setLoading(false)
          return
        }

        if (event === 'SIGNED_IN' && session?.user) {
          console.log('👤 User signed in:', session.user.email)
          // No procesar aquí, ya se maneja en signIn()
        }
      }
    )

    return () => {
      console.log('🧹 Cleaning up auth listener')
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const contextValue: AuthContextType = {
    user,
    usuario,
    loading,
    signIn,
    signOut,
    isAdmin: usuario?.rol === 'admin',
    isGerente: usuario?.rol === 'gerente', 
    isVendedor: usuario?.rol === 'vendedor',
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}