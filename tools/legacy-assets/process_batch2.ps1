Add-Type -AssemblyName System.Drawing

$baseDir = "C:\Users\JUAN\.gemini\antigravity-ide\brain\84f22564-6b96-4698-9a27-8707d56a816c\.user_uploaded"
$destDir = "c:\Users\JUAN\.gemini\antigravity-ide\scratch\byf-proyecto-grado\frontend\assets\clientes"

# 1. Andrés Carne de Res
$srcAndres = Join-Path $baseDir "media_1790554242263.png"
if (Test-Path $srcAndres) {
    $bmp = [System.Drawing.Bitmap]::FromFile($srcAndres)
    $w = $bmp.Width; $h = $bmp.Height
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
                    $alpha = [Math]::Max(0, [Math]::Min(255, 255 - ($lum - 210) * 7))
                }
                $outBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $p.R, $p.G, $p.B))
            }
        }
    }
    $outBmp.Save("$destDir\andres.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose(); $outBmp.Dispose()
    Write-Output "Processed andres.png"
}

# 2. Pelikan
$srcPelikan = Join-Path $baseDir "media_1790554242284.png"
if (Test-Path $srcPelikan) {
    $bmp = [System.Drawing.Bitmap]::FromFile($srcPelikan)
    $w = $bmp.Width; $h = $bmp.Height
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
                    $alpha = [Math]::Max(0, [Math]::Min(255, 255 - ($lum - 210) * 7))
                }
                $outBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $p.R, $p.G, $p.B))
            }
        }
    }
    $outBmp.Save("$destDir\pelikan.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose(); $outBmp.Dispose()
    Write-Output "Processed pelikan.png"
}

# 3. Colombian Air Cargo S.A.S.
$srcCAC = Join-Path $baseDir "media_1790554242335.jpg"
if (Test-Path $srcCAC) {
    $bmp = [System.Drawing.Bitmap]::FromFile($srcCAC)
    $w = $bmp.Width; $h = $bmp.Height
    $outBmp = New-Object System.Drawing.Bitmap($w, $h)
    for ($y = 0; $y -lt $h; $y++) {
        for ($x = 0; $x -lt $w; $x++) {
            $p = $bmp.GetPixel($x, $y)
            # Make pure white background transparent
            if ($p.R -gt 245 -and $p.G -gt 245 -and $p.B -gt 245) {
                $outBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            } else {
                $alpha = 255
                if ($p.R -gt 225 -and $p.G -gt 225 -and $p.B -gt 225) {
                    $lum = [int](($p.R + $p.G + $p.B) / 3)
                    $alpha = [Math]::Max(0, [Math]::Min(255, 255 - ($lum - 225) * 8))
                }
                $outBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $p.R, $p.G, $p.B))
            }
        }
    }
    $outBmp.Save("$destDir\colombian-air-cargo.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose(); $outBmp.Dispose()
    Write-Output "Processed colombian-air-cargo.png"
}

# 4. BLAS Panama Airport Services
$srcBlas = Join-Path $baseDir "media_1790554242301.jpg"
if (Test-Path $srcBlas) {
    $bmp = [System.Drawing.Bitmap]::FromFile($srcBlas)
    # Save as high quality PNG badge with slight padding
    $bmp.Save("$destDir\blas.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Processed blas.png"
}

# 5. Vialcor
$srcVialcor = Join-Path $baseDir "media_1790554251125.jpg"
if (Test-Path $srcVialcor) {
    $bmp = [System.Drawing.Bitmap]::FromFile($srcVialcor)
    $w = $bmp.Width; $h = $bmp.Height
    $outBmp = New-Object System.Drawing.Bitmap($w, $h)
    for ($y = 0; $y -lt $h; $y++) {
        for ($x = 0; $x -lt $w; $x++) {
            $p = $bmp.GetPixel($x, $y)
            if ($p.R -gt 240 -and $p.G -gt 240 -and $p.B -gt 240) {
                $outBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            } else {
                $alpha = 255
                if ($p.R -gt 220 -and $p.G -gt 220 -and $p.B -gt 220) {
                    $lum = [int](($p.R + $p.G + $p.B) / 3)
                    $alpha = [Math]::Max(0, [Math]::Min(255, 255 - ($lum - 220) * 8))
                }
                $outBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $p.R, $p.G, $p.B))
            }
        }
    }
    $outBmp.Save("$destDir\vialcor.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose(); $outBmp.Dispose()
    Write-Output "Processed vialcor.png"
}

# 6. Aerosur S.A.S.
$srcAerosur = Join-Path $baseDir "media_1790554242348.png"
if (Test-Path $srcAerosur) {
    $bmp = [System.Drawing.Bitmap]::FromFile($srcAerosur)
    $w = $bmp.Width; $h = $bmp.Height
    Write-Output "Aerosur dimensions: $w x $h"
    $corner = $bmp.GetPixel(0, 0)
    Write-Output "Aerosur corner: A=$($corner.A), R=$($corner.R), G=$($corner.G), B=$($corner.B)"
    
    # Check pixels of the text / plane
    # If the text is white, on a light background we need it to be legible.
    # Let's create an optimized version for light backgrounds where white letters have a crisp dark tint (#0f172a or deep navy)
    $outBmp = New-Object System.Drawing.Bitmap($w, $h)
    for ($y = 0; $y -lt $h; $y++) {
        for ($x = 0; $x -lt $w; $x++) {
            $p = $bmp.GetPixel($x, $y)
            if ($p.A -lt 10) {
                $outBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            } else {
                # If it's the white text or outline
                if ($p.R -gt 200 -and $p.G -gt 200 -and $p.B -gt 200) {
                    # Give it high contrast deep slate/navy color
                    $outBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($p.A, 15, 23, 42))
                } else {
                    $outBmp.SetPixel($x, $y, $p)
                }
            }
        }
    }
    $outBmp.Save("$destDir\aerosur.png", [System.Drawing.Imaging.ImageFormat]::Png)
    # Also save original copy
    Copy-Item $srcAerosur "$destDir\aerosur-original.png" -Force
    $bmp.Dispose(); $outBmp.Dispose()
    Write-Output "Processed aerosur.png"
}
