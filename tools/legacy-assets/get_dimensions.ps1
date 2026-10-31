Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('C:\Users\JUAN\.gemini\antigravity-ide\brain\4fd58a20-6e7c-4281-9b00-a006f06aa3d7\.user_uploaded\media_1793326282618.jpg')
Write-Output "User uploaded: $($img.Width) x $($img.Height)"
$img.Dispose()
