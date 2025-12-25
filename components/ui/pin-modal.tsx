// Path: components\ui\pin-modal.tsx
'use client'

import { useState, useRef, useEffect } from 'react'

interface PinModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  sucursalId: string
  titulo?: string
  mensaje?: string
}

export default function PinModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  sucursalId,
  titulo = 'Verificacion Requerida',
  mensaje = 'Ingresa el PIN de seguridad para continuar'
}: PinModalProps) {
  const [pin, setPin] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Enfocar primer input al abrir
  useEffect(() => {
    if (isOpen) {
      setPin(['', '', '', ''])
      setError('')
      setTimeout(() => {
        inputRefs.current[0]?.focus()
      }, 100)
    }
  }, [isOpen])

  const handleChange = (index: number, value: string) => {
    // Solo permitir numeros
    if (value && !/^\d$/.test(value)) return

    const newPin = [...pin]
    newPin[index] = value
    setPin(newPin)
    setError('')

    // Mover al siguiente input
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
    if (e.key === 'Enter') {
      handleVerify()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (pastedData) {
      const newPin = ['', '', '', '']
      for (let i = 0; i < pastedData.length; i++) {
        newPin[i] = pastedData[i]
      }
      setPin(newPin)
      inputRefs.current[Math.min(pastedData.length, 3)]?.focus()
    }
  }

  const handleVerify = async () => {
    const pinIngresado = pin.join('')
    
    if (pinIngresado.length !== 4) {
      setError('El PIN debe tener 4 digitos')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Verificar PIN contra la base de datos
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const { data, error: dbError } = await supabase
        .from('sucursales')
        .select('pin_seguridad')
        .eq('id', sucursalId)
        .single()

      if (dbError) throw dbError

      if (!data.pin_seguridad) {
        setError('No hay PIN configurado. Configuralo en Ajustes.')
        return
      }

      if (data.pin_seguridad === pinIngresado) {
        onSuccess()
        onClose()
      } else {
        setError('PIN incorrecto')
        setPin(['', '', '', ''])
        inputRefs.current[0]?.focus()
      }
    } catch (error) {
      console.error('Error verifying PIN:', error)
      setError('Error al verificar el PIN')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{titulo}</h3>
          <p className="text-sm text-gray-500 mt-1">{mensaje}</p>
        </div>

        {/* Inputs de PIN */}
        <div className="flex justify-center space-x-2 mb-4">
          {pin.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              className={`w-12 h-14 text-center text-2xl font-bold border-2 rounded-xl transition-all
                ${error ? 'border-red-300 bg-red-50' : 'border-gray-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200'}
              `}
              disabled={loading}
            />
          ))}
        </div>

        {/* Mensaje de error */}
        {error && (
          <p className="text-sm text-red-600 text-center mb-4">{error}</p>
        )}

        {/* Botones */}
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleVerify}
            className="btn-primary flex-1"
            disabled={loading || pin.join('').length < 4}
          >
            {loading ? (
              <>
                <span className="spinner mr-2"></span>
                Verificando...
              </>
            ) : (
              'Verificar'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}