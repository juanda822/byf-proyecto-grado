$f1 = 'C:\Users\JUAN\.gemini\antigravity-ide\brain\4fd58a20-6e7c-4281-9b00-a006f06aa3d7\.system_generated\steps\71\content.md'
$f2 = 'C:\Users\JUAN\.gemini\antigravity-ide\brain\4fd58a20-6e7c-4281-9b00-a006f06aa3d7\.system_generated\steps\79\content.md'

foreach ($f in @($f1, $f2)) {
    if (Test-Path $f) {
        $txt = Get-Content $f -Raw
        if ($txt -match '<meta name="title" content="([^"]+)">') {
            Write-Output "Meta title: $($matches[1])"
        } elseif ($txt -match '<title>([^<]+)</title>') {
            Write-Output "Title: $($matches[1])"
        }
    }
}
