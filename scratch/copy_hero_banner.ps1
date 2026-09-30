Add-Type -AssemblyName System.Drawing
$src = "C:\Users\JUAN\.gemini\antigravity-ide\brain\84f22564-6b96-4698-9a27-8707d56a816c\.user_uploaded\media_1790739945600.png"
$img = [System.Drawing.Image]::FromFile($src)
Write-Output "Dimensions: $($img.Width) x $($img.Height)"
$img.Dispose()

Copy-Item $src "assets\uniformes\hero-banner-composite.png" -Force
Copy-Item $src "frontend\assets\uniformes\hero-banner-composite.png" -Force
Write-Output "Copied hero-banner-composite.png successfully."
