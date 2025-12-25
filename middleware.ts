// Path: middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Si no hay usuario y está intentando acceder a rutas protegidas
  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Si hay usuario, verificar estado de la sucursal
  if (user && request.nextUrl.pathname.startsWith('/dashboard')) {
    // Obtener datos del usuario desde la tabla usuarios
    const { data: usuario } = await supabase
      .from('usuarios')
      .select(`
        id,
        sucursal_id,
        rol,
        sucursales (
          id,
          activa
        )
      `)
      .eq('auth_id', user.id)
      .single()

    // Si el usuario tiene sucursal asignada y está inactiva
    if (usuario?.sucursal_id && usuario.sucursales) {
      const sucursalActiva = (usuario.sucursales as any).activa

      // Si la sucursal está pausada y NO está ya en la página de sistema-pausado
      if (!sucursalActiva && !request.nextUrl.pathname.startsWith('/sistema-pausado')) {
        return NextResponse.redirect(new URL('/sistema-pausado', request.url))
      }

      // Si la sucursal está activa y está en la página de sistema-pausado
      if (sucursalActiva && request.nextUrl.pathname.startsWith('/sistema-pausado')) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
