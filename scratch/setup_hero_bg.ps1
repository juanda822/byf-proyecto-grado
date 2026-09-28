$src = "C:\Users\JUAN\.gemini\antigravity-ide\brain\84f22564-6b96-4698-9a27-8707d56a816c\.user_uploaded\media_1790560177829.png"
$destPng = "c:\Users\JUAN\.gemini\antigravity-ide\scratch\byf-proyecto-grado\frontend\assets\hero-silk-bg.png"
$destJpg = "c:\Users\JUAN\.gemini\antigravity-ide\scratch\byf-proyecto-grado\frontend\assets\hero-silk-bg.jpg"

Add-Type -AssemblyName System.Drawing

Copy-Item -Path $src -Destination $destPng -Force

$bmp = [System.Drawing.Bitmap]::FromFile($src)
$w = $bmp.Width
$h = $bmp.Height
Write-Output "Silk Background Dimensions: $w x $h"

# Also save high quality JPEG for ultra fast loading
$bmp.Save($destJpg, [System.Drawing.Imaging.ImageFormat]::Jpeg)
$bmp.Dispose()

Write-Output "Saved hero-silk-bg.png and hero-silk-bg.jpg successfully."
