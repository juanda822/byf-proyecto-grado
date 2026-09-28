Add-Type -AssemblyName System.Drawing

$destDir = "c:\Users\JUAN\.gemini\antigravity-ide\scratch\byf-proyecto-grado\frontend\assets\clientes"
if (!(Test-Path $destDir)) {
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
}

$files = @(
    @{ Src = "media_1790554208453.png"; Name = "caribe-cargo.png"; Title = "Caribe Cargo S.A.S." },
    @{ Src = "media_1790554208482.png"; Name = "byd.png"; Title = "BYD" },
    @{ Src = "media_1790554208521.png"; Name = "menzies-aviation.png"; Title = "Menzies Aviation" },
    @{ Src = "media_1790554208540.png"; Name = "scania.png"; Title = "Scania" },
    @{ Src = "media_1790554208547.png"; Name = "krones.png"; Title = "Krones" }
)

$baseDir = "C:\Users\JUAN\.gemini\antigravity-ide\brain\84f22564-6b96-4698-9a27-8707d56a816c\.user_uploaded"

foreach ($f in $files) {
    $srcPath = Join-Path $baseDir $f.Src
    $destPath = Join-Path $destDir $f.Name
    
    if (Test-Path $srcPath) {
        $bmp = [System.Drawing.Bitmap]::FromFile($srcPath)
        $w = $bmp.Width
        $h = $bmp.Height
        $corner = $bmp.GetPixel(0, 0)
        Write-Output "[$($f.Name)] Dim: $w x $h | Corner: A=$($corner.A), R=$($corner.R), G=$($corner.G), B=$($corner.B)"
        
        # Check if background is white and should be made transparent
        $outBmp = New-Object System.Drawing.Bitmap($w, $h)
        for ($y = 0; $y -lt $h; $y++) {
            for ($x = 0; $x -lt $w; $x++) {
                $p = $bmp.GetPixel($x, $y)
                # If transparent or near white
                if ($p.A -lt 10 -or ($p.R -gt 245 -and $p.G -gt 245 -and $p.B -gt 245)) {
                    $outBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
                } else {
                    $alpha = $p.A
                    if ($p.R -gt 220 -and $p.G -gt 220 -and $p.B -gt 220) {
                        $lum = [int](($p.R + $p.G + $p.B) / 3)
                        $alpha = [Math]::Max(0, [Math]::Min(255, 255 - ($lum - 220) * 7))
                    }
                    $outBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $p.R, $p.G, $p.B))
                }
            }
        }
        
        $outBmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        $outBmp.Dispose()
        Write-Output "Processed and saved: $destPath"
    } else {
        Write-Output "File not found: $srcPath"
    }
}
