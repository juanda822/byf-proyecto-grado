Add-Type -AssemblyName System.Drawing

$srcPath = Resolve-Path 'assets/productos/logo-reflective.png'
$src = [System.Drawing.Bitmap]::FromFile($srcPath)
$w = $src.Width
$h = $src.Height

# 1. Create Black Logo for Manifesto
$bmpBlack = New-Object System.Drawing.Bitmap($w, $h)
for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
        $c = $src.GetPixel($x, $y)
        if ($c.A -gt 5) {
            $bmpBlack.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($c.A, 0, 0, 0))
        } else {
            $bmpBlack.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        }
    }
}
$bmpBlack.Save('assets/productos/logo-reflective-black.png', [System.Drawing.Imaging.ImageFormat]::Png)
$bmpBlack.Dispose()
Write-Output "Created logo-reflective-black.png"

# 2. Create Hero Neon + White Logo
$bmpHero = New-Object System.Drawing.Bitmap($w, $h)
for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
        $c = $src.GetPixel($x, $y)
        if ($c.A -gt 5) {
            # Check if this pixel belongs to REFLECTIVE (lower area, or grey: |R-G| < 25 and |G-B| < 25)
            $diffRG = [Math]::Abs([int]$c.R - [int]$c.G)
            $diffGB = [Math]::Abs([int]$c.G - [int]$c.B)
            if ($y -gt ($h * 0.65) -or ($diffRG -lt 25 -and $diffGB -lt 25)) {
                # White for REFLECTIVE
                $bmpHero.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($c.A, 255, 255, 255))
            } else {
                # Bright Neon Green for B&F and Planet (#39ff14)
                $intensity = [Math]::Max([int]$c.R, [Math]::Max([int]$c.G, [int]$c.B)) / 255.0
                $r = [Math]::Min(255, [int](57 * $intensity + 10))
                $g = [Math]::Min(255, [int](255 * $intensity))
                $b = [Math]::Min(255, [int](20 * $intensity))
                $bmpHero.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($c.A, $r, $g, $b))
            }
        } else {
            $bmpHero.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        }
    }
}
$bmpHero.Save('assets/productos/logo-reflective-hero.png', [System.Drawing.Imaging.ImageFormat]::Png)
$bmpHero.Dispose()
$src.Dispose()
Write-Output "Created logo-reflective-hero.png"
