// Path: app\loading.tsx
import { Suspense } from 'react'

export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="spinner mb-4"></div>
        <h2 className="text-lg font-medium text-gray-900">Cargando LicoPos...</h2>
        <p className="text-gray-600">Un momento por favor</p>
      </div>
    </div>
  )
}