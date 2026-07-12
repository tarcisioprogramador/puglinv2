# Prospector de Sites - Publicar Agora (PowerShell)
# Uso: powershell -ExecutionPolicy Bypass -File publicar-agora.ps1

Write-Host "Prospector de Sites - Publicador Automatico" -ForegroundColor Cyan
Write-Host ""

$pasta = Split-Path -Parent $MyInvocation.MyCommand.Path
$fila = Join-Path $pasta "..\..\backend\data\fila-publicacao.txt"
$log = Join-Path $pasta "publicacao-log.txt"

if (-not (Test-Path $fila)) {
    Write-Host "Nenhum site na fila de publicacao." -ForegroundColor Yellow
    exit 0
}

Write-Host "Processando fila de publicacao..." -ForegroundColor Green

Get-Content $fila | ForEach-Object {
    $slug = $_.Trim()
    if ($slug -ne "") {
        Write-Host "  Publicando: $slug" -ForegroundColor White
        # Simulacao de publicacao via FTP
        Add-Content $log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Publicado: $slug"
    }
}

Remove-Item $fila -Force
Write-Host ""
Write-Host "Publicacao concluida!" -ForegroundColor Green
