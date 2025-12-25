# Configuración
$extensions = @("*.tsx", "*.ts", "*.jsx", "*.js")
$excludeFolders = @("node_modules", ".next", "dist", "out", ".git", "coverage", "build")

Write-Host "🚀 Agregando comentarios de ruta a los archivos..." -ForegroundColor Cyan
Write-Host ""

$processedCount = 0
$skippedCount = 0

foreach ($ext in $extensions) {
    Get-ChildItem -Recurse -Filter $ext | 
        Where-Object { 
            $path = $_.FullName
            $shouldExclude = $false
            foreach ($folder in $excludeFolders) {
                if ($path -match [regex]::Escape($folder)) {
                    $shouldExclude = $true
                    break
                }
            }
            -not $shouldExclude
        } | 
        ForEach-Object {
            $filePath = $_.FullName
            $relativePath = $_.FullName.Replace((Get-Location).Path + "\", "")
            
            # Leer el contenido del archivo
            $content = Get-Content $filePath -Raw -ErrorAction SilentlyContinue
            
            if ($null -eq $content) {
                return
            }
            
            # Verificar si ya tiene el comentario de ruta
            if ($content -notmatch "^//\s*Path:") {
                # Agregar el comentario al inicio
                $newContent = "// Path: $relativePath`n" + $content
                Set-Content $filePath $newContent -NoNewline
                Write-Host "Agregado: $relativePath" -ForegroundColor Green
                $script:processedCount++
            } else {
                Write-Host "Ya existe: $relativePath" -ForegroundColor Yellow
                $script:skippedCount++
            }
        }
}

Write-Host ""
Write-Host "Proceso completado!" -ForegroundColor Cyan
Write-Host "Archivos procesados: $processedCount" -ForegroundColor Green
Write-Host "Archivos omitidos: $skippedCount" -ForegroundColor Yellow