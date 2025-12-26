# Script de diagnóstico completo PWA
# Ejecutar: .\diagnostico-completo.ps1
# Copiar TODO el resultado

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DIAGNÓSTICO COMPLETO PWA - LICOPOS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. ESTRUCTURA DE ARCHIVOS
Write-Host "1. ESTRUCTURA DE ARCHIVOS:" -ForegroundColor Yellow
Write-Host "-------------------------" -ForegroundColor Yellow
$archivos = @(
    "middleware.ts",
    "next.config.js",
    "app\layout.tsx",
    "public\manifest.json",
    "components\install-pwa.tsx",
    "app\dashboard\layout.tsx"
)

foreach ($archivo in $archivos) {
    if (Test-Path $archivo) {
        $size = (Get-Item $archivo).Length
        Write-Host "✅ $archivo ($size bytes)" -ForegroundColor Green
    } else {
        Write-Host "❌ $archivo NO EXISTE" -ForegroundColor Red
    }
}
Write-Host ""

# 2. ICONOS
Write-Host "2. ICONOS EN public\icons:" -ForegroundColor Yellow
Write-Host "-------------------------" -ForegroundColor Yellow
if (Test-Path "public\icons") {
    $iconos = Get-ChildItem "public\icons\*.png"
    Write-Host "Total iconos PNG: $($iconos.Count)" -ForegroundColor Cyan
    foreach ($icono in $iconos) {
        Write-Host "  ✅ $($icono.Name)" -ForegroundColor Green
    }
} else {
    Write-Host "❌ Carpeta public\icons NO EXISTE" -ForegroundColor Red
}
Write-Host ""

# 3. CONTENIDO DEL MIDDLEWARE (config.matcher)
Write-Host "3. MIDDLEWARE CONFIG:" -ForegroundColor Yellow
Write-Host "-------------------------" -ForegroundColor Yellow
if (Test-Path "middleware.ts") {
    $middlewareContent = Get-Content "middleware.ts" -Raw
    $matcherStart = $middlewareContent.IndexOf("export const config")
    if ($matcherStart -ge 0) {
        $matcherSection = $middlewareContent.Substring($matcherStart, [Math]::Min(500, $middlewareContent.Length - $matcherStart))
        Write-Host $matcherSection -ForegroundColor White
    } else {
        Write-Host "❌ No se encontró 'export const config'" -ForegroundColor Red
    }
} else {
    Write-Host "❌ middleware.ts NO EXISTE" -ForegroundColor Red
}
Write-Host ""

# 4. CONTENIDO DEL MANIFEST (primeras líneas)
Write-Host "4. MANIFEST.JSON (primeras 5 líneas):" -ForegroundColor Yellow
Write-Host "-------------------------" -ForegroundColor Yellow
if (Test-Path "public\manifest.json") {
    Get-Content "public\manifest.json" -Head 5 | ForEach-Object { Write-Host $_ }
    Write-Host ""
    $manifestSize = (Get-Item "public\manifest.json").Length
    Write-Host "Tamaño: $manifestSize bytes" -ForegroundColor Cyan
} else {
    Write-Host "❌ public\manifest.json NO EXISTE" -ForegroundColor Red
}
Write-Host ""

# 5. APP LAYOUT METADATA
Write-Host "5. APP\LAYOUT.TSX - METADATA:" -ForegroundColor Yellow
Write-Host "-------------------------" -ForegroundColor Yellow
if (Test-Path "app\layout.tsx") {
    $layoutContent = Get-Content "app\layout.tsx" -Raw
    if ($layoutContent -match "manifest:\s*['\`"]([^'\`"]+)['\`"]") {
        Write-Host "✅ Manifest configurado: $($matches[1])" -ForegroundColor Green
    } else {
        Write-Host "❌ NO se encontró configuración de manifest" -ForegroundColor Red
    }
    
    if ($layoutContent -match "icons:\s*\{") {
        Write-Host "✅ Icons configurado" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Icons NO configurado" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ app\layout.tsx NO EXISTE" -ForegroundColor Red
}
Write-Host ""

# 6. NEXT CONFIG
Write-Host "6. NEXT.CONFIG.JS:" -ForegroundColor Yellow
Write-Host "-------------------------" -ForegroundColor Yellow
if (Test-Path "next.config.js") {
    $nextConfig = Get-Content "next.config.js" -Raw
    if ($nextConfig -match "manifest") {
        Write-Host "✅ Contiene configuración de manifest" -ForegroundColor Green
    } else {
        Write-Host "⚠️ NO contiene configuración de manifest" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "Primeras 20 líneas:" -ForegroundColor Cyan
    Get-Content "next.config.js" -Head 20 | ForEach-Object { Write-Host $_ }
} else {
    Write-Host "❌ next.config.js NO EXISTE" -ForegroundColor Red
}
Write-Host ""

# 7. DASHBOARD LAYOUT
Write-Host "7. DASHBOARD LAYOUT:" -ForegroundColor Yellow
Write-Host "-------------------------" -ForegroundColor Yellow
if (Test-Path "app\dashboard\layout.tsx") {
    $dashboardLayout = Get-Content "app\dashboard\layout.tsx" -Raw
    if ($dashboardLayout -match "InstallPWA") {
        Write-Host "✅ InstallPWA importado/usado" -ForegroundColor Green
    } else {
        Write-Host "❌ InstallPWA NO encontrado" -ForegroundColor Red
    }
} else {
    Write-Host "❌ app\dashboard\layout.tsx NO EXISTE" -ForegroundColor Red
}
Write-Host ""

# 8. PROCESO DE NODE CORRIENDO
Write-Host "8. SERVIDOR NEXT.JS:" -ForegroundColor Yellow
Write-Host "-------------------------" -ForegroundColor Yellow
$nodeProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcess) {
    Write-Host "✅ Servidor Node.js corriendo (PID: $($nodeProcess.Id))" -ForegroundColor Green
} else {
    Write-Host "⚠️ No se detectó proceso Node.js" -ForegroundColor Yellow
}
Write-Host ""

# 9. ENCODINGS
Write-Host "9. CONFIGURACIÓN DE ENCODING:" -ForegroundColor Yellow
Write-Host "-------------------------" -ForegroundColor Yellow
Write-Host "Default Encoding: $([System.Text.Encoding]::Default.EncodingName)" -ForegroundColor Cyan
Write-Host "Code Page: $([System.Text.Encoding]::Default.CodePage)" -ForegroundColor Cyan
Write-Host ""

# 10. VERIFICACIÓN CRÍTICA
Write-Host "10. VERIFICACIÓN CRÍTICA:" -ForegroundColor Yellow
Write-Host "-------------------------" -ForegroundColor Yellow

$problemas = @()

if (-not (Test-Path "public\manifest.json")) {
    $problemas += "❌ CRÍTICO: manifest.json NO existe en public\"
}

if (-not (Test-Path "public\icons")) {
    $problemas += "❌ CRÍTICO: Carpeta icons\ NO existe en public\"
}

if (Test-Path "middleware.ts") {
    $middlewareContent = Get-Content "middleware.ts" -Raw
    if ($middlewareContent -notmatch "manifest\.json") {
        $problemas += "⚠️ IMPORTANTE: middleware.ts NO excluye manifest.json"
    }
    if ($middlewareContent -notmatch "icons") {
        $problemas += "⚠️ IMPORTANTE: middleware.ts NO excluye icons/"
    }
}

if ($problemas.Count -eq 0) {
    Write-Host "✅ NO se encontraron problemas críticos" -ForegroundColor Green
} else {
    foreach ($problema in $problemas) {
        Write-Host $problema -ForegroundColor Red
    }
}
Write-Host ""

# RESUMEN
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FIN DEL DIAGNÓSTICO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "COPIA TODO EL RESULTADO DE ARRIBA Y ENVÍALO" -ForegroundColor Yellow
Write-Host ""