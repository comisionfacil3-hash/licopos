// Path: app\dashboard\productos\importar\page.tsx
'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { Categoria } from '@/types/database'
import { 
  leerArchivoExcel, 
  validateExcelRow, 
  excelRowToProducto,
  generarPlantillaExcel 
} from '@/lib/utils/excel-productos'

export default function ImportarProductosPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [previewData, setPreviewData] = useState<any[]>([])
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [importResults, setImportResults] = useState<{
    success: number
    errors: number
    details: string[]
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const fetchCategorias = async () => {
    try {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('empresa_id', usuario?.empresa_id)
        .eq('activa', true)
        .order('orden')

      if (error) throw error
      setCategorias(data || [])
    } catch (error) {
      console.error('Error fetching categorias:', error)
    }
  }

  const handleDownloadTemplate = () => {
    if (categorias.length === 0) {
      fetchCategorias().then(() => {
        generarPlantillaExcel(categorias)
      })
    } else {
      generarPlantillaExcel(categorias)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      alert('Solo se permiten archivos Excel (.xlsx, .xls)')
      return
    }

    setFile(selectedFile)
    
    try {
      setLoading(true)
      const data = await leerArchivoExcel(selectedFile)
      
      // Validar datos
      const errors: string[] = []
      data.forEach((row, index) => {
        const validation = validateExcelRow(row, index)
        errors.push(...validation.errors)
      })

      setPreviewData(data.slice(0, 5)) // Mostrar solo primeras 5 filas
      setValidationErrors(errors)
    } catch (error) {
      console.error('Error reading file:', error)
      alert('Error al leer el archivo Excel')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!file || validationErrors.length > 0) return

    setImporting(true)
    const results = {
      success: 0,
      errors: 0,
      details: [] as string[]
    }

    try {
      // Fetch categorias si no las tenemos
      if (categorias.length === 0) {
        await fetchCategorias()
      }

      const data = await leerArchivoExcel(file)
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i]
        
        try {
          // Validar fila individual
          const validation = validateExcelRow(row, i)
          if (!validation.valid) {
            results.errors++
            results.details.push(`Fila ${i + 2}: Datos inválidos`)
            continue
          }

          // Convertir a producto
          const productoData = excelRowToProducto(row, usuario?.sucursal_id!, categorias)
          
          // Generar código si no existe
          if (!productoData.codigo) {
            const { data: codigoData } = await supabase.rpc('generar_codigo_producto', {
              p_sucursal_id: usuario?.sucursal_id
            })
            productoData.codigo = codigoData
          }

          // Insertar producto
          const { error } = await supabase
            .from('productos')
            .insert(productoData)

          if (error) {
            results.errors++
            results.details.push(`Fila ${i + 2}: ${error.message}`)
          } else {
            results.success++
          }

        } catch (error) {
          results.errors++
          results.details.push(`Fila ${i + 2}: Error inesperado`)
        }
      }

      setImportResults(results)

    } catch (error) {
      console.error('Error importing:', error)
      alert('Error durante la importación')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="p-4 pb-24">
      {/* Header */}
      <div className="flex items-center mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg mr-3"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Importar Productos</h1>
          <p className="text-gray-600">Carga múltiples productos desde Excel</p>
        </div>
      </div>

      {!importResults ? (
        <>
          {/* Paso 1: Descargar plantilla */}
          <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="bg-primary-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3">1</span>
              Descargar Plantilla
            </h3>
            <p className="text-gray-600 mb-4">
              Descarga la plantilla Excel con el formato correcto y ejemplos de productos.
            </p>
            <button
              onClick={handleDownloadTemplate}
              className="btn-primary"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Descargar Plantilla Excel
            </button>
          </div>

          {/* Paso 2: Subir archivo */}
          <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="bg-primary-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3">2</span>
              Subir Archivo Excel
            </h3>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              
              {file ? (
                <div className="space-y-3">
                  <svg className="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  <p className="text-green-600 font-medium">{file.name}</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary"
                  >
                    Cambiar Archivo
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Haz clic para seleccionar
                    </button>
                    <p className="text-gray-500">o arrastra tu archivo Excel aquí</p>
                  </div>
                  <p className="text-sm text-gray-400">Solo archivos .xlsx y .xls</p>
                </div>
              )}
            </div>

            {loading && (
              <div className="mt-4 text-center">
                <span className="spinner mr-2"></span>
                Procesando archivo...
              </div>
            )}
          </div>

          {/* Preview y validación */}
          {previewData.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
              <h3 className="text-lg font-semibold mb-4">Vista Previa de Datos</h3>
              
              {/* Errores de validación */}
              {validationErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-red-800 mb-2">
                    Errores encontrados ({validationErrors.length})
                  </h4>
                  <div className="max-h-32 overflow-y-auto">
                    {validationErrors.slice(0, 10).map((error, index) => (
                      <p key={index} className="text-sm text-red-700">{error}</p>
                    ))}
                    {validationErrors.length > 10 && (
                      <p className="text-sm text-red-700">...y {validationErrors.length - 10} errores más</p>
                    )}
                  </div>
                </div>
              )}

              {/* Tabla preview */}
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Nombre</th>
                      <th className="text-left p-2">Categoría</th>
                      <th className="text-left p-2">P. Compra</th>
                      <th className="text-left p-2">P. Venta</th>
                      <th className="text-left p-2">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-2">{row.nombre}</td>
                        <td className="p-2">{row.categoria || 'Sin categoría'}</td>
                        <td className="p-2">{row.precio_compra}</td>
                        <td className="p-2">{row.precio_venta}</td>
                        <td className="p-2">{row.stock_actual}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-gray-500 mt-2">
                  Mostrando primeras 5 filas de {previewData.length} productos
                </p>
              </div>
            </div>
          )}

          {/* Botón importar */}
          {file && validationErrors.length === 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <span className="bg-primary-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3">3</span>
                Confirmar Importación
              </h3>
              <p className="text-gray-600 mb-4">
                Se importarán {previewData.length} productos. Esta acción no se puede deshacer.
              </p>
              <button
                onClick={handleImport}
                disabled={importing}
                className="btn-primary w-full"
              >
                {importing ? (
                  <>
                    <span className="spinner mr-2"></span>
                    Importando productos...
                  </>
                ) : (
                  'Importar Productos'
                )}
              </button>
            </div>
          )}
        </>
      ) : (
        /* Resultados de importación */
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Resultados de Importación</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-700">Productos creados</p>
              <p className="text-2xl font-bold text-green-800">{importResults.success}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-sm text-red-700">Errores</p>
              <p className="text-2xl font-bold text-red-800">{importResults.errors}</p>
            </div>
          </div>

          {importResults.details.length > 0 && (
            <div className="mb-6">
              <h4 className="font-medium mb-2">Detalles:</h4>
              <div className="max-h-48 overflow-y-auto bg-gray-50 p-3 rounded-lg">
                {importResults.details.map((detail, index) => (
                  <p key={index} className="text-sm text-gray-700">{detail}</p>
                ))}
              </div>
            </div>
          )}

          <div className="flex space-x-3">
            <button
              onClick={() => router.push('/dashboard/productos')}
              className="btn-primary flex-1"
            >
              Ver Productos
            </button>
            <button
              onClick={() => {
                setFile(null)
                setPreviewData([])
                setValidationErrors([])
                setImportResults(null)
                if (fileInputRef.current) {
                  fileInputRef.current.value = ''
                }
              }}
              className="btn-secondary flex-1"
            >
              Importar Más
            </button>
          </div>
        </div>
      )}
    </div>
  )
}