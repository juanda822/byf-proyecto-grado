Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile((Resolve-Path 'assets/productos/logo-reflective.png'))
Write-Output "Logo reflective: $($img.Width) x $($img.Height)"
$img.Dispose()
