$baseDir = "C:\Users\JUAN\.gemini\antigravity-ide\brain\84f22564-6b96-4698-9a27-8707d56a816c\.user_uploaded"
$destDir = "c:\Users\JUAN\.gemini\antigravity-ide\scratch\byf-proyecto-grado\frontend\assets\uniformes"

if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
}

# 1. Copiar Hero Image (Modelos en tela de seda)
Copy-Item (Join-Path $baseDir "media_1790736463259.jpg") "$destDir\hero-uniformes.jpg" -Force

# 2. Copiar Mockup Manos con Catálogo
Copy-Item (Join-Path $baseDir "media_1790736463251.png") "$destDir\catalogo-mockup.png" -Force

# 3. Copiar Categoría Corporativos
Copy-Item (Join-Path $baseDir "media_1790736698462.png") "$destDir\cat-corporativo.png" -Force

# 4. Copiar Categoría Salud
Copy-Item (Join-Path $baseDir "media_1790736698484.png") "$destDir\cat-salud.png" -Force

Write-Output "Assets copiados exitosamente a $destDir"
