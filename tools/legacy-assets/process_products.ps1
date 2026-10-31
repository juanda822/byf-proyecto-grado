Add-Type -AssemblyName System.Drawing

$baseDir = "C:\Users\JUAN\.gemini\antigravity-ide\brain\84f22564-6b96-4698-9a27-8707d56a816c\.user_uploaded"
$destDir = "c:\Users\JUAN\.gemini\antigravity-ide\scratch\byf-proyecto-grado\frontend\assets\productos"

if (!(Test-Path $destDir)) {
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
}

# 1. Copiar las 4 fotos de tarjetas
Copy-Item (Join-Path $baseDir "media_1790563497193.jpg") "$destDir\linea-uniformes.jpg" -Force
Copy-Item (Join-Path $baseDir "media_1790563497162.jpg") "$destDir\linea-moda.jpg" -Force
Copy-Item (Join-Path $baseDir "media_1790563497132.png") "$destDir\linea-reflectivo.png" -Force
Copy-Item (Join-Path $baseDir "media_1790563502042.png") "$destDir\linea-merch.png" -Force

Write-Output "Copied 4 product card posters."

# 2. Procesar los 4 logos inferiores asegurando fondo transparente
$logos = @(
    @{ Src = "media_1790563528169.png"; Dest = "logo-uniforms.png"; Name = "B&F Uniforms" },
    @{ Src = "media_1790563528195.png"; Dest = "logo-diana-baron.png"; Name = "Diana Baron" },
    @{ Src = "media_1790563528200.png"; Dest = "logo-reflective.png"; Name = "B&F Reflective" },
    @{ Src = "media_1790563528185.png"; Dest = "logo-print.png"; Name = "B&F Print" }
)

foreach ($l in $logos) {
    $srcPath = Join-Path $baseDir $l.Src
    $destPath = Join-Path $destDir $l.Dest
    
    $bmp = [System.Drawing.Bitmap]::FromFile($srcPath)
    $w = $bmp.Width
    $h = $bmp.Height
    
    $outBmp = New-Object System.Drawing.Bitmap($w, $h)
    for ($y = 0; $y -lt $h; $y++) {
        for ($x = 0; $x -lt $w; $x++) {
            $p = $bmp.GetPixel($x, $y)
            if ($p.A -lt 10 -or ($p.R -gt 240 -and $p.G -gt 240 -and $p.B -gt 240)) {
                $outBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            } else {
                $alpha = $p.A
                if ($p.R -gt 210 -and $p.G -gt 210 -and $p.B -gt 210) {
                    $lum = [int](($p.R + $p.G + $p.B) / 3)
                    $alpha = [Math]::Max(0, [Math]::Min(255, 255 - ($lum - 210) * 8))
                }
                $outBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $p.R, $p.G, $p.B))
            }
        }
    }
    
    $outBmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $outBmp.Dispose()
    Write-Output "Processed logo: $($l.Dest)"
}
