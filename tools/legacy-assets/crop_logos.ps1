Add-Type -AssemblyName System.Drawing

$baseDir = "C:\Users\JUAN\.gemini\antigravity-ide\brain\84f22564-6b96-4698-9a27-8707d56a816c\.user_uploaded"
$destDir = "c:\Users\JUAN\.gemini\antigravity-ide\scratch\byf-proyecto-grado\frontend\assets\productos"

$logos = @(
    @{ Src = "media_1790563528169.png"; Dest = "logo-uniforms.png"; Name = "B&F Uniforms" },
    @{ Src = "media_1790563528195.png"; Dest = "logo-diana-baron.png"; Name = "Diana Baron" },
    @{ Src = "media_1790563528200.png"; Dest = "logo-reflective.png"; Name = "B&F Reflective" },
    @{ Src = "media_1790563528185.png"; Dest = "logo-print.png"; Name = "B&F Print" }
)

foreach ($l in $logos) {
    $srcFile = Join-Path $baseDir $l.Src
    $destFile = Join-Path $destDir $l.Dest
    
    $bmp = [System.Drawing.Bitmap]::FromFile($srcFile)
    $w = $bmp.Width
    $h = $bmp.Height
    
    # 1. Encontrar Bounding Box (píxeles que son contenido real: opacos y no blancos)
    $minX = $w; $maxX = 0; $minY = $h; $maxY = 0
    for ($y = 0; $y -lt $h; $y++) {
        for ($x = 0; $x -lt $w; $x++) {
            $p = $bmp.GetPixel($x, $y)
            $isContent = ($p.A -gt 30) -and -not ($p.R -gt 238 -and $p.G -gt 238 -and $p.B -gt 238)
            if ($isContent) {
                if ($x -lt $minX) { $minX = $x }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }
    
    # Si por alguna razón no detectó contenido, usar tamaño original
    if ($maxX -lt $minX -or $maxY -lt $minY) {
        $minX = 0; $maxX = $w - 1; $minY = 0; $maxY = $h - 1
    }
    
    # Padding de seguridad de 10px
    $pad = 10
    $cropX = [Math]::Max(0, $minX - $pad)
    $cropY = [Math]::Max(0, $minY - $pad)
    $cropW = [Math]::Min($w - $cropX, ($maxX - $minX + 1) + ($pad * 2))
    $cropH = [Math]::Min($h - $cropY, ($maxY - $minY + 1) + ($pad * 2))
    
    # 2. Crear Bitmap recortado con canal alfa transparente y antialiasing
    $croppedBmp = New-Object System.Drawing.Bitmap($cropW, $cropH)
    for ($cy = 0; $cy -lt $cropH; $cy++) {
        $origY = $cropY + $cy
        for ($cx = 0; $cx -lt $cropW; $cx++) {
            $origX = $cropX + $cx
            $p = $bmp.GetPixel($origX, $origY)
            
            # Fondo transparente
            if ($p.A -lt 25 -or ($p.R -gt 245 -and $p.G -gt 245 -and $p.B -gt 245)) {
                $croppedBmp.SetPixel($cx, $cy, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            } elseif ($p.R -gt 210 -and $p.G -gt 210 -and $p.B -gt 210) {
                # Antialiasing en los bordes
                $lum = [int](($p.R + $p.G + $p.B) / 3)
                $alpha = [Math]::Max(0, [Math]::Min(255, 255 - [int](($lum - 210) * 7.2)))
                $croppedBmp.SetPixel($cx, $cy, [System.Drawing.Color]::FromArgb($alpha, $p.R, $p.G, $p.B))
            } else {
                $croppedBmp.SetPixel($cx, $cy, [System.Drawing.Color]::FromArgb($p.A, $p.R, $p.G, $p.B))
            }
        }
    }
    
    $tempOut = "$destFile.tmp.png"
    $croppedBmp.Save($tempOut, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $croppedBmp.Dispose()
    
    Move-Item -Path $tempOut -Destination $destFile -Force
    Write-Output "Recortado: $($l.Name) de ${w}x${h} a ${cropW}x${cropH}"
}
