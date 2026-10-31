$baseDir = "C:\Users\JUAN\.gemini\antigravity-ide\brain\84f22564-6b96-4698-9a27-8707d56a816c\.user_uploaded"
$destDirs = @(
    "c:\Users\JUAN\.gemini\antigravity-ide\scratch\byf-proyecto-grado\assets\uniformes",
    "c:\Users\JUAN\.gemini\antigravity-ide\scratch\byf-proyecto-grado\frontend\assets\uniformes"
)

$mapping = @(
    @{ Src = "media_1790738413546.png"; Dest = "cat-seguridad.png"; Name = "Seguridad" },
    @{ Src = "media_1790738413592.png"; Dest = "cat-escolares.png"; Name = "Escolares" },
    @{ Src = "media_1790738413666.png"; Dest = "cat-epp.png"; Name = "Proteccion Personal (EPP)" },
    @{ Src = "media_1790738413708.png"; Dest = "cat-hoteleria.png"; Name = "Hoteleria & Restaurantes" }
)

foreach ($d in $destDirs) {
    if (-not (Test-Path $d)) {
        New-Item -ItemType Directory -Force -Path $d | Out-Null
    }
    foreach ($m in $mapping) {
        $srcPath = Join-Path $baseDir $m.Src
        $destPath = Join-Path $d $m.Dest
        Copy-Item -Path $srcPath -Destination $destPath -Force
        Write-Output "Copiado $($m.Name) -> $destPath"
    }
}
