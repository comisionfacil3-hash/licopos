'use client'

import DashboardLayout from '@/components/layout/dashboard-layout'
import ProtectedRoute from '@/components/layout/protected-route'
import InstallPWA from '@/components/install-pwa'

export default function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute requireSucursal>
      <DashboardLayout>
        {children}
        
        {/* Botón flotante "Instalar App" */}
        <InstallPWA />
      </DashboardLayout>
    </ProtectedRoute>
  )
}