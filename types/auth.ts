import { Usuario } from './database'

export interface AuthUser {
  id: string
  email: string
  usuario?: Usuario
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthState {
  user: AuthUser | null
  loading: boolean
  error: string | null
}

export interface SessionInfo {
  empresa_id: string
  sucursal_id?: string
  rol: 'admin' | 'gerente' | 'vendedor'
  permisos: Record<string, any>
}