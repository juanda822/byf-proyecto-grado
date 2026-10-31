Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Bitmap]::FromFile((Resolve-Path 'assets/reflectivo/chevron-cropped.png'))

# Crop exactly the chevron area (around X: 35 to 445, Y: 15 to 175)
$minX = 35; $maxX = 445; $minY = 15; $maxY = 175
$w = $maxX - $minX
$h = $maxY - $minY

$res = New-Object System.Drawing.Bitmap($w, $h)

for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
        $origX = $x + $minX
        $origY = $y + $minY
        $c = $src.GetPixel($origX, $origY)
        
        # Check if the pixel is lime green background or brush artifact on far left
        if (($c.G -gt 145 -and $c.G -gt ($c.R + 15) -and $c.B -lt 110) -or ($x -lt 15 -and $y -lt 80)) {
            $res.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } else {
            $res.SetPixel($x, $y, $c)
        }
    }
}

$res.Save('assets/reflectivo/chevron-perspective.png', [System.Drawing.Imaging.ImageFormat]::Png)
$res.Dispose()
$src.Dispose()
Write-Output "Saved chevron-perspective.png"
