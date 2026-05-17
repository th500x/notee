# Apply SQL migrations to fill common gaps vs production (XAMPP / local MySQL).
# Usage (from repo root or this folder):
#   powershell -ExecutionPolicy Bypass -File backend/database/scripts/apply-local-schema-gaps.ps1
#
# Env: MYSQL_EXE (default C:\xampp\mysql\bin\mysql.exe), DB_NAME (default 05_san_storm), DB_USER (default root)

$ErrorActionPreference = "Stop"
$MysqlExe = if ($env:MYSQL_EXE) { $env:MYSQL_EXE } else { "C:\xampp\mysql\bin\mysql.exe" }
$Db = if ($env:DB_NAME) { $env:DB_NAME } else { "05_san_storm" }
$User = if ($env:DB_USER) { $env:DB_USER } else { "root" }

$ScriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DatabaseDir = Split-Path -Parent $ScriptsDir
$MigrationsDir = Join-Path $DatabaseDir "migrations"

if (-not (Test-Path $MysqlExe)) {
  Write-Host "mysql.exe not found: $MysqlExe — set MYSQL_EXE" -ForegroundColor Red
  exit 1
}

$files = @(
  "add-city-siege-tables.sql",
  "create-chats-table.sql",
  "create-config-texts.sql",
  "create-memorial-images-table.sql",
  "create-temp-character-ranking.sql",
  "add-card-pool-tables.sql",
  "create-temp-ranking-snapshots-table.sql",
  "create-player-garrison.sql",
  "create-runtime-tables-from-design-doc-01-1.sql"
)

Write-Host "Database: $Db  User: $User" -ForegroundColor Cyan
foreach ($f in $files) {
  $path = Join-Path $MigrationsDir $f
  if (-not (Test-Path $path)) {
    Write-Host "SKIP missing file: $f" -ForegroundColor Yellow
    continue
  }
  Write-Host "---- $f ----" -ForegroundColor Green
  try {
    Get-Content -Raw -Encoding UTF8 $path | & $MysqlExe -u $User -h localhost -P 3306 $Db 2>&1
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) { throw "mysql exit $LASTEXITCODE" }
  } catch {
    Write-Host "FAILED: $_" -ForegroundColor Red
  }
}
Write-Host "Done. If texts/legions/config_events etc. are still missing, use mysqldump --no-data from production (see docs/mysql.md)." -ForegroundColor Cyan
