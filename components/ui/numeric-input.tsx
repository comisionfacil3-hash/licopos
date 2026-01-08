'use client'

import React, { useState, forwardRef, useEffect } from 'react'

// Extiende las props de un input HTML estándar
export interface NumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  allowDecimal?: boolean; // Nueva prop
}

const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
  ({ className, value, onChange, onFocus, onBlur, allowDecimal = true, ...props }, ref) => {
    // Estado interno para manejar el valor del input como string
    const [displayValue, setDisplayValue] = useState(String(value))

    // Sincronizar el estado interno si el prop `value` cambia desde el padre
    useEffect(() => {
      setDisplayValue(String(value))
    }, [value])

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // Si el valor es '0', vaciar el campo para que el usuario pueda escribir
      if (e.target.value === '0') {
        setDisplayValue('')
      }
      // Ejecutar el onFocus original si existe
      if (onFocus) {
        onFocus(e)
      }
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // Usar parseFloat o parseInt según la prop
      const parser = allowDecimal ? parseFloat : parseInt;
      const currentValue = parser(e.target.value) || 0;
      setDisplayValue(String(currentValue))

      // Asegurarse de que el padre tenga el valor formateado
      if (currentValue !== value) {
          onChange(currentValue)
      }

      // Ejecutar el onBlur original si existe
      if (onBlur) {
        onBlur(e)
      }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value
      // Validar según si se permiten decimales o no
      const regex = allowDecimal ? /^\d*\.?\d*$/ : /^\d*$/;

      if (regex.test(inputValue)) {
        setDisplayValue(inputValue)
        // Notificar al padre, usando el parser adecuado
        const parser = allowDecimal ? parseFloat : parseInt;
        onChange(parser(inputValue) || 0)
      }
    }

    return (
      <input
        type="text" // Usar text para tener más control
        inputMode={allowDecimal ? "decimal" : "numeric"} // Cambiar inputMode dinámicamente
        className={className}
        ref={ref}
        value={displayValue}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        {...props}
      />
    )
  }
)

NumericInput.displayName = 'NumericInput'

export { NumericInput }
