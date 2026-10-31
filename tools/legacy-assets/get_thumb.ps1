$videoUrl = "https://img.youtube.com/vi/uWHnjV3EY5k/maxresdefault.jpg"
$dest = "c:\Users\JUAN\.gemini\antigravity-ide\scratch\byf-proyecto-grado\frontend\assets\video-poster.jpg"

try {
    Invoke-WebRequest -Uri $videoUrl -OutFile $dest -TimeoutSec 10
    Write-Output "Downloaded maxresdefault thumbnail successfully."
} catch {
    $fallbackUrl = "https://img.youtube.com/vi/uWHnjV3EY5k/hqdefault.jpg"
    Invoke-WebRequest -Uri $fallbackUrl -OutFile $dest -TimeoutSec 10
    Write-Output "Downloaded hqdefault thumbnail successfully."
}
