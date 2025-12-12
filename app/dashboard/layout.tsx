'use client'

import DashboardLayout from '@/components/layout/dashboard-layout'
import ProtectedRoute from '@/components/layout/protected-route'

export default function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute requireSucursal>
      <DashboardLayout>
        {children}
      </DashboardLayout>
    </ProtectedRoute>
  )
}