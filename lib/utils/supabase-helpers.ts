import { createClient } from '@/lib/supabase/client'
import { createClient as createServerClient } from '@/lib/supabase/server'

// Helper para cliente (browser)
export const supabase = createClient()

// Helper para server con manejo de errores
export async function getServerSupabase() {
  try {
    return await createServerClient()
  } catch (error) {
    console.error('Error creating Supabase server client:', error)
    throw error
  }
}

// Helper para obtener usuario actual (client-side)
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error }
}

// Helper para cerrar sesión
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

// Helper para validar email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Helper para validar contraseña
export function isValidPassword(password: string): boolean {
  return password.length >= 6
}