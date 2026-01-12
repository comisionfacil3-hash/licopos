'use client'

import { useState, useEffect } from 'react'
import { Smartphone, Apple, Monitor, Download, ChevronDown, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Platform = 'android' | 'ios' | 'desktop' | 'unknown'

export default function InstallAppCard() {
  const [platform, setPlatform] = useState<Platform>('unknown')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    // Verificar si ya está instalado
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Verificar si el usuario cerró la tarjeta
    const dismissed = localStorage.getItem('install-card-dismissed')
    if (dismissed) {
      setIsDismissed(true)
      return
    }

    // Detectar plataforma
    const userAgent = navigator.userAgent.toLowerCase()
    
    if (/android/.test(userAgent)) {
      setPlatform('android')
    } else if (/iphone|ipad|ipod/.test(userAgent)) {
      setPlatform('ios')
    } else {
      setPlatform('desktop')
    }

    // Detectar evento de instalación (Chrome/Edge)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // Detectar cuando se instala
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  const handleInstall = async () => {
    if (platform === 'ios') {
      setShowInstructions(!showInstructions)
      return
    }

    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setIsInstalled(true)
    }

    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    localStorage.setItem('install-card-dismissed', 'true')
  }

  // No mostrar si ya está instalado o fue cerrado
  if (isInstalled || isDismissed) return null

  const getPlatformIcon = () => {
    switch (platform) {
      case 'android':
        return <Smartphone className="w-8 h-8 text-emerald-600" />
      case 'ios':
        return <Apple className="w-8 h-8 text-emerald-600" />
      case 'desktop':
        return <Monitor className="w-8 h-8 text-emerald-600" />
      default:
        return <Download className="w-8 h-8 text-emerald-600" />
    }
  }

  const getPlatformText = () => {
    switch (platform) {
      case 'android':
        return {
          title: 'Instalar App Android',
          description: 'Instala ControlaPos en tu dispositivo Android para acceso rápido',
          button: 'Instalar ahora'
        }
      case 'ios':
        return {
          title: 'Instalar en iPhone/iPad',
          description: 'Agrega ControlaPos a tu pantalla de inicio',
          button: 'Ver instrucciones'
        }
      case 'desktop':
        return {
          title: 'Instalar en Windows/Mac',
          description: 'Instala ControlaPos como aplicación de escritorio',
          button: 'Instalar aplicación'
        }
      default:
        return {
          title: 'Instalar Aplicación',
          description: 'Accede más rápido instalando ControlaPos',
          button: 'Instalar'
        }
    }
  }

  const text = getPlatformText()

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-lg border-2 border-emerald-200 p-6 relative">
      {/* Botón cerrar */}
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
        title="Cerrar"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-4">
        {/* Icono de plataforma */}
        <div className="flex-shrink-0 w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-sm">
          {getPlatformIcon()}
        </div>

        {/* Contenido */}
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            {text.title}
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            {text.description}
          </p>

          {/* Botón de instalación */}
          <button
            onClick={handleInstall}
            className="inline-flex items-center gap-2 bg-emerald-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            {text.button}
            {platform === 'ios' && (
              <ChevronDown className={`w-4 h-4 transition-transform ${showInstructions ? 'rotate-180' : ''}`} />
            )}
          </button>
        </div>
      </div>

      {/* Instrucciones para iOS */}
      {platform === 'ios' && showInstructions && (
        <div className="mt-4 pt-4 border-t border-emerald-200">
          <p className="text-sm font-semibold text-gray-700 mb-2">Pasos para instalar:</p>
          <ol className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold text-xs">1</span>
              <span>Toca el botón <strong>Compartir</strong> (ícono ↗️) en Safari</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold text-xs">2</span>
              <span>Desplázate y selecciona <strong>"Agregar a pantalla de inicio"</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold text-xs">3</span>
              <span>Toca <strong>"Agregar"</strong> en la esquina superior derecha</span>
            </li>
          </ol>
        </div>
      )}
    </div>
  )
}