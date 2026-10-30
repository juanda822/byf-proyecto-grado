Add-Type -AssemblyName System.Drawing

$srcPath = 'C:\Users\JUAN\.gemini\antigravity-ide\brain\4fd58a20-6e7c-4281-9b00-a006f06aa3d7\.user_uploaded\media_1793326282618.jpg'
$src = [System.Drawing.Image]::FromFile($srcPath)

# The uploaded image is 845 x 1024.
# The chevron is around Y: 800 to 980, X: 200 to 650.
$cropRect = New-Object System.Drawing.Rectangle(180, 800, 485, 180)
$bmp = New-Object System.Drawing.Bitmap($cropRect.Width, $cropRect.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($src, (New-Object System.Drawing.Rectangle(0, 0, $cropRect.Width, $cropRect.Height)), $cropRect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()

$bmp.Save('c:\Users\JUAN\.gemini\antigravity-ide\scratch\byf-proyecto-grado\assets\reflectivo\chevron-cropped.png', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$src.Dispose()
Write-Output "Cropped chevron saved."
