import { createClient } from '@/lib/supabase/client'

export async function testSupabaseConnection() {
  try {
    const supabase = createClient()
    
    // Probar conexión
    const { data: empresas, error } = await supabase
      .from('empresas')
      .select('*')
      .limit(1)
    
    if (error) {
      console.error('Error conectando a Supabase:', error.message)
      return { success: false, error: error.message }
    }
    
    console.log('✅ Conexión exitosa a Supabase')
    console.log('Empresas encontradas:', empresas)
    return { success: true, data: empresas }
    
  } catch (error) {
    console.error('Error:', error)
    return { success: false, error: 'Error de conexión' }
  }
}