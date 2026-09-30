Add-Type -AssemblyName System.Drawing
$mockupPath = "C:\Users\JUAN\.gemini\antigravity-ide\brain\84f22564-6b96-4698-9a27-8707d56a816c\.user_uploaded\media_1790736264770.png"
$destDir = "c:\Users\JUAN\.gemini\antigravity-ide\scratch\byf-proyecto-grado\frontend\assets\uniformes"

$bmp = [System.Drawing.Bitmap]::FromFile($mockupPath)
Write-Output "Mockup Size: $($bmp.Width) x $($bmp.Height)"

# In the mockup of 1000 x 2400 (or similar aspect ratio):
# Let's crop:
# Row 1:
# Hotelería: Left column, Row 1
# EPP: Middle column, Row 1
# Escolares: Right column, Row 1
# Row 2:
# Seguridad: Left column, Row 2

# We can crop the square artwork portion of each category
# Let's check proportions
$w = $bmp.Width
$h = $bmp.Height

# We know the category section is roughly between Y=24% and Y=52% of total height
# Column 1: X: 5% to 34%
# Column 2: X: 35% to 64%
# Column 3: X: 65% to 94%

# Row 1 square artwork:
$r1_y = [int]($h * 0.242)
$box_h = [int]($w * 0.28) # square aspect
$box_w = [int]($w * 0.28)

$c1_x = [int]($w * 0.058)
$c2_x = [int]($w * 0.36)
$c3_x = [int]($w * 0.66)

# Row 2 square artwork:
$r2_y = [int]($h * 0.385)

$crops = @(
    @{ Name = "cat-hoteleria.png"; Rect = [System.Drawing.Rectangle]::new($c1_x, $r1_y, $box_w, $box_h) },
    @{ Name = "cat-epp.png"; Rect = [System.Drawing.Rectangle]::new($c2_x, $r1_y, $box_w, $box_h) },
    @{ Name = "cat-escolares.png"; Rect = [System.Drawing.Rectangle]::new($c3_x, $r1_y, $box_w, $box_h) },
    @{ Name = "cat-seguridad.png"; Rect = [System.Drawing.Rectangle]::new($c1_x, $r2_y, $box_w, $box_h) }
)

foreach ($c in $crops) {
    $target = New-Object System.Drawing.Bitmap($c.Rect.Width, $c.Rect.Height)
    $g = [System.Drawing.Graphics]::FromImage($target)
    $g.DrawImage($bmp, [System.Drawing.Rectangle]::new(0, 0, $target.Width, $target.Height), $c.Rect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    $outPath = Join-Path $destDir $c.Name
    $target.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $target.Dispose()
    Write-Output "Cropped $($c.Name)"
}

$bmp.Dispose()
