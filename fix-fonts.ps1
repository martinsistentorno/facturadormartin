$files = Get-ChildItem -Path "f:\backup\Command Soluciones\Personas\Facturador\cliente-martinsist\src" -Recurse -Include "*.jsx"

foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw
    $original = $content

    # Remove all inline fontFamily style overrides
    $content = $content -replace " style=\{\{ fontFamily: 'var\(--font-outfit\)' \}\}", ""
    $content = $content -replace " style=\{\{ fontFamily: 'var\(--font-jakarta\)' \}\}", ""
    $content = $content -replace " style=\{\{fontFamily: 'var\(--font-montserrat\)'\}\}", ""
    $content = $content -replace " style=\{\{ fontFamily: 'var\(--font-montserrat\)' \}\}", ""
    $content = $content -replace " style=\{\{ fontFamily: 'Inter' \}\}", ""
    $content = $content -replace " style=\{\{fontFamily: 'Inter'\}\}", ""
    $content = $content -replace " style=\{\{ fontFamily: 'Montserrat' \}\}", ""
    $content = $content -replace " style=\{\{fontFamily: 'Montserrat'\}\}", ""
    $content = $content -replace " style=\{\{ fontFamily: 'Space Grotesk' \}\}", ""

    if ($content -ne $original) {
        Set-Content $f.FullName $content -NoNewline
        Write-Host "Updated: $($f.Name)"
    }
}
