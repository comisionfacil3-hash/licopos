import { redirect } from 'next/navigation'

export default function HomePage() {
  // Por ahora redirigir a login
  // Más tarde verificaremos si hay sesión activa
  redirect('/login')
}