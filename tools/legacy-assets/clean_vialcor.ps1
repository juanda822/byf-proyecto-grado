Add-Type -AssemblyName System.Drawing

$src = "C:\Users\JUAN\.gemini\antigravity-ide\brain\84f22564-6b96-4698-9a27-8707d56a816c\.user_uploaded\media_1790554251125.jpg"
$destDir = "c:\Users\JUAN\.gemini\antigravity-ide\scratch\byf-proyecto-grado\frontend\assets\clientes"

$bmp = [System.Drawing.Bitmap]::FromFile($src)
$w = $bmp.Width
$h = $bmp.Height

Write-Output "Original Vialcor Dimensions: $w x $h"

# 1. Full cleaned transparent version (removing the stray mark at the top)
$fullClean = New-Object System.Drawing.Bitmap($w, $h)

for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
        $p = $bmp.GetPixel($x, $y)
        
        # Remove top-left stray speck (y < 120 and x < 150)
        if ($y -lt 120 -and $x -lt 150) {
            $fullClean.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            continue
        }
        
        # Background transparency
        if ($p.R -gt 240 -and $p.G -gt 240 -and $p.B -gt 240) {
            $fullClean.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } else {
            $alpha = 255
            if ($p.R -gt 220 -and $p.G -gt 220 -and $p.B -gt 220) {
                $lum = [int](($p.R + $p.G + $p.B) / 3)
                $alpha = [Math]::Max(0, [Math]::Min(255, 255 - ($lum - 220) * 8))
            }
            $fullClean.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $p.R, $p.G, $p.B))
        }
    }
}

# 2. Crop the main logo mark: "VAC" symbol + "VIALCOR" wordmark
# Find bounds up to the gap before "SOLUCIONES ARQUITECTÓNICAS" (around y = 620)
$cutoffY = [int]($h * 0.62)

$minX = $w; $maxX = 0; $minY = $h; $maxY = 0

for ($y = 120; $y -lt $cutoffY; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
        $p = $fullClean.GetPixel($x, $y)
        if ($p.A -gt 30) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

$pad = 10
$cropX = [Math]::Max(0, $minX - $pad)
$cropY = [Math]::Max(0, $minY - $pad)
$cropW = [Math]::Min($w - $cropX, ($maxX - $minX) + ($pad * 2))
$cropH = [Math]::Min($h - $cropY, ($maxY - $minY) + ($pad * 2))

$rect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)
$markBmp = $fullClean.Clone($rect, $fullClean.PixelFormat)

$markBmp.Save("$destDir\vialcor.png", [System.Drawing.Imaging.ImageFormat]::Png)
$fullClean.Save("$destDir\vialcor-full.png", [System.Drawing.Imaging.ImageFormat]::Png)

Write-Output "Saved cropped vialcor.png: $cropW x $cropH and vialcor-full.png"

$bmp.Dispose()
$fullClean.Dispose()
$markBmp.Dispose()
