'use client'

import { useState, useEffect } from 'react'
import { X, Download } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Verificar si ya está instalado
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Detectar evento de instalación
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      
      // Mostrar banner después de 3 segundos
      setTimeout(() => {
        setShowBanner(true)
      }, 3000)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // Detectar cuando se instala
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setShowBanner(false)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setShowBanner(false)
    }

    setDeferredPrompt(null)
  }

  const handleClose = () => {
    setShowBanner(false)
    // Opcional: guardar en localStorage para no mostrar de nuevo
    localStorage.setItem('pwa-install-dismissed', 'true')
  }

  // No mostrar nada si ya está instalado
  if (isInstalled) return null

  // No mostrar si el usuario lo cerró
  if (!showBanner || !deferredPrompt) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-slide-up">
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4">
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-3 pr-8">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5 text-emerald-600" />
          </div>
          
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-1">
              ¿Instalar ControlaPos?
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Accede más rápido desde tu pantalla de inicio
            </p>
            
            <div className="flex gap-2">
              <button
                onClick={handleInstallClick}
                className="flex-1 bg-emerald-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-emerald-700 transition-colors text-sm"
              >
                Instalar
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium text-sm transition-colors"
              >
                Ahora no
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}