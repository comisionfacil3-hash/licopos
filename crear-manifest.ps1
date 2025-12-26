# Script para crear manifest.json con encoding UTF-8 correcto
# Ejecutar: .\crear-manifest.ps1

$manifestContent = @'
{
  "name": "LicoPos - Sistema de Gestión para Licorerías",
  "short_name": "LicoPos",
  "description": "Sistema integral para gestión de licorerías multi-empresa",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#10B981",
  "orientation": "portrait-primary",
  "categories": ["business", "productivity", "finance"],
  "lang": "es-BO",
  "scope": "/",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-180x180.png",
      "sizes": "180x180",
      "type": "image/png",
      "purpose": "apple-touch-icon"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
'@

# Crear el archivo con UTF-8 SIN BOM (correcto para JSON)
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$manifestPath = "public\manifest.json"

[System.IO.File]::WriteAllText($manifestPath, $manifestContent, $utf8NoBom)

Write-Host "Archivo creado: $manifestPath" -ForegroundColor Green
Write-Host ""
Write-Host "Verificando contenido..." -ForegroundColor Yellow

# Verificar que se creó correctamente
$verificacion = Get-Content $manifestPath -Encoding UTF8 | Select-String "Gestión"
if ($verificacion) {
    Write-Host "Encoding correcto: $verificacion" -ForegroundColor Green
} else {
    Write-Host "Error: Encoding incorrecto" -ForegroundColor Red
}

Write-Host ""
Write-Host "Siguiente paso:" -ForegroundColor Cyan
Write-Host "1. Reinicia el servidor: npm run dev" -ForegroundColor White
Write-Host "2. Cierra Chrome completamente" -ForegroundColor White
Write-Host "3. Abre Chrome fresco" -ForegroundColor White