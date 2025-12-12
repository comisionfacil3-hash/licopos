'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function DebugPage() {
  const [session, setSession] = useState<any>(null)
  const [usuarios, setUsuarios] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)

      const { data } = await supabase.from('usuarios').select('*')
      setUsuarios(data || [])
    }

    checkAuth()
  }, [supabase])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Debug Auth</h1>
      
      <div className="space-y-6">
        <div className="card card-padding">
          <h2 className="text-lg font-bold mb-2">Sesión Actual:</h2>
          <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto">
            {JSON.stringify(session, null, 2)}
          </pre>
        </div>

        <div className="card card-padding">
          <h2 className="text-lg font-bold mb-2">Usuarios en DB:</h2>
          <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto">
            {JSON.stringify(usuarios, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}