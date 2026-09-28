Add-Type -AssemblyName System.Drawing

$src = "c:\Users\JUAN\.gemini\antigravity-ide\scratch\byf-proyecto-grado\frontend\assets\video-poster.jpg"
$bmp = [System.Drawing.Bitmap]::FromFile($src)
$w = $bmp.Width
$h = $bmp.Height

Write-Output "Initial video poster size: $w x $h"

# Find top black bar
$topBar = 0
for ($y = 0; $y -lt [int]($h * 0.2); $y++) {
    $p = $bmp.GetPixel([int]($w / 2), $y)
    if ($p.R -lt 25 -and $p.G -lt 25 -and $p.B -lt 25) {
        $topBar = $y + 1
    } else {
        break
    }
}

# Find bottom black bar
$bottomBar = 0
for ($y = $h - 1; $y -gt [int]($h * 0.8); $y--) {
    $p = $bmp.GetPixel([int]($w / 2), $y)
    if ($p.R -lt 25 -and $p.G -lt 25 -and $p.B -lt 25) {
        $bottomBar = ($h - $y)
    } else {
        break
    }
}

Write-Output "Detected bars: Top=$topBar, Bottom=$bottomBar"

if ($topBar -gt 5 -and $bottomBar -gt 5) {
    $cropH = $h - ($topBar + $bottomBar)
    $rect = New-Object System.Drawing.Rectangle(0, $topBar, $w, $cropH)
    $cropped = $bmp.Clone($rect, $bmp.PixelFormat)
    $bmp.Dispose()
    
    # Save to clean poster
    $cropped.Save("$src.tmp.jpg", [System.Drawing.Imaging.ImageFormat]::Jpeg)
    $cropped.Dispose()
    
    Move-Item -Path "$src.tmp.jpg" -Destination $src -Force
    Write-Output "Successfully cropped letterbox bars! New height: $cropH"
} else {
    $bmp.Dispose()
    Write-Output "No significant black bars found."
}
