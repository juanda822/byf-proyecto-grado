Add-Type -AssemblyName System.Drawing

$src = "C:\Users\JUAN\.gemini\antigravity-ide\brain\84f22564-6b96-4698-9a27-8707d56a816c\.user_uploaded\media_1790549562024.png"
$destDir = "c:\Users\JUAN\.gemini\antigravity-ide\scratch\byf-proyecto-grado\frontend\assets\logos"

if (!(Test-Path $destDir)) {
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
}

# 1. Copiar original intacto
Copy-Item -Path $src -Destination "$destDir\byf-logo-original.png" -Force

$bmp = [System.Drawing.Bitmap]::FromFile($src)
$width = $bmp.Width
$height = $bmp.Height

Write-Output "Image Dimensions: $width x $height"

# Check if image has transparency or white background
$samplePixel = $bmp.GetPixel(0, 0)
Write-Output "Corner pixel color: A=$($samplePixel.A), R=$($samplePixel.R), G=$($samplePixel.G), B=$($samplePixel.B)"

$darkBmp = New-Object System.Drawing.Bitmap($width, $height)
$whiteBmp = New-Object System.Drawing.Bitmap($width, $height)

for ($y = 0; $y -lt $height; $y++) {
    for ($x = 0; $x -lt $width; $x++) {
        $p = $bmp.GetPixel($x, $y)
        
        # If the pixel is near-white or transparent
        if ($p.A -lt 10 -or ($p.R -gt 240 -and $p.G -gt 240 -and $p.B -gt 240)) {
            $darkBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            $whiteBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } else {
            $alpha = $p.A
            if ($p.R -gt 200 -and $p.G -gt 200 -and $p.B -gt 200) {
                # Edge antialiasing smoothing
                $luminance = [int](($p.R + $p.G + $p.B) / 3)
                $alpha = [Math]::Max(0, [Math]::Min(255, 255 - ($luminance - 200) * 6))
            }
            
            # Dark version: Preserve deep teal color of the original logo
            $darkBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $p.R, $p.G, $p.B))
            
            # White version: Convert to pure white with same alpha
            $whiteBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, 255, 255, 255))
        }
    }
}

$darkBmp.Save("$destDir\byf-logo-dark.png", [System.Drawing.Imaging.ImageFormat]::Png)
$whiteBmp.Save("$destDir\byf-logo-white.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "Saved byf-logo-dark.png and byf-logo-white.png"

# Emblem cropping
$colHasDark = @()
for ($x = 0; $x -lt $width; $x++) {
    $hasDark = $false
    for ($y = 0; $y -lt $height; $y++) {
        $p = $darkBmp.GetPixel($x, $y)
        if ($p.A -gt 50) {
            $hasDark = $true
            break
        }
    }
    $colHasDark += $hasDark
}

# Find gap between emblem and text
$splitX = [int]($width * 0.47)
for ($x = [int]($width * 0.40); $x -lt [int]($width * 0.55); $x++) {
    if (-not $colHasDark[$x] -and -not $colHasDark[$x+1] -and -not $colHasDark[$x+2]) {
        $splitX = $x + 1
        break
    }
}

Write-Output "Split X: $splitX"

# Bounding box of emblem
$minX = $width
$maxX = 0
$minY = $height
$maxY = 0

for ($y = 0; $y -lt $height; $y++) {
    for ($x = 0; $x -lt $splitX; $x++) {
        $p = $darkBmp.GetPixel($x, $y)
        if ($p.A -gt 30) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

$pad = 12
$cropX = [Math]::Max(0, $minX - $pad)
$cropY = [Math]::Max(0, $minY - $pad)
$cropW = [Math]::Min($width - $cropX, ($maxX - $minX) + ($pad * 2))
$cropH = [Math]::Min($height - $cropY, ($maxY - $minY) + ($pad * 2))

$rect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)
$emblemDark = $darkBmp.Clone($rect, $darkBmp.PixelFormat)
$emblemWhite = $whiteBmp.Clone($rect, $whiteBmp.PixelFormat)

$emblemDark.Save("$destDir\byf-hero-emblem.png", [System.Drawing.Imaging.ImageFormat]::Png)
$emblemWhite.Save("$destDir\byf-hero-emblem-white.png", [System.Drawing.Imaging.ImageFormat]::Png)

Write-Output "Saved byf-hero-emblem.png and byf-hero-emblem-white.png (Cropped: $cropW x $cropH)"

$bmp.Dispose()
$darkBmp.Dispose()
$whiteBmp.Dispose()
$emblemDark.Dispose()
$emblemWhite.Dispose()
