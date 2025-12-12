'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function NotFound() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="card card-padding max-w-md w-full mx-4 text-center">
        <div className="mb-6">
          <div className="text-6xl font-bold text-primary-500 mb-4">404</div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Página no encontrada</h2>
          <p className="text-gray-600">La página que buscas no existe o fue movida.</p>
        </div>
        
        <div className="space-y-3">
          <Link href="/" className="btn-primary w-full block">
            Ir al inicio
          </Link>
          <button
            onClick={() => router.back()}
            className="btn-secondary w-full"
          >
            Regresar
          </button>
        </div>
      </div>
    </div>
  )
}