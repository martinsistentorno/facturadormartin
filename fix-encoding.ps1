$files = @(
    "f:\backup\Command Soluciones\Personas\Facturador\cliente-martinsist\src\components\EmisorSetupModal.jsx",
    "f:\backup\Command Soluciones\Personas\Facturador\cliente-martinsist\src\components\ToastContainer.jsx",
    "f:\backup\Command Soluciones\Personas\Facturador\cliente-martinsist\src\components\BulkImportModal.jsx",
    "f:\backup\Command Soluciones\Personas\Facturador\cliente-martinsist\src\components\FilterBar.jsx",
    "f:\backup\Command Soluciones\Personas\Facturador\cliente-martinsist\src\components\Layout.jsx",
    "f:\backup\Command Soluciones\Personas\Facturador\cliente-martinsist\src\components\SaleDetailDrawer.jsx",
    "f:\backup\Command Soluciones\Personas\Facturador\cliente-martinsist\src\components\SalesTable.jsx",
    "f:\backup\Command Soluciones\Personas\Facturador\cliente-martinsist\src\pages\Login.jsx"
)

foreach ($path in $files) {
    if (Test-Path $path) {
        $content = [System.IO.File]::ReadAllText($path)
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
        Write-Host "Fixed encoding: $path"
    }
}
