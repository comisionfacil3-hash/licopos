'use client'

import AdminLayout from '@/components/layout/admin-layout'
import ProtectedRoute from '@/components/layout/protected-route'

export default function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute requiredRole="admin">
      <AdminLayout>
        {children}
      </AdminLayout>
    </ProtectedRoute>
  )
}