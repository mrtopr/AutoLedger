# ==============================================================================
# TradeLedger ERP — Automated Database & Store Backup Script (Windows / PowerShell)
# ==============================================================================
# Usage in Windows Task Scheduler:
#   powershell -ExecutionPolicy Bypass -File .\scripts\backup-db.ps1
# ==============================================================================

param (
    [string]$BackupDir = ".\backups",
    [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

Write-Host "================================================================="
Write-Host "Starting TradeLedger ERP automated backup at $(Get-Date -Format s)..."
Write-Host "================================================================="

# 1. PostgreSQL Database Backup
if ($env:DATABASE_URL) {
    $DbBackupFile = Join-Path $BackupDir "db_backup_${Timestamp}.dump"
    Write-Host "Backing up PostgreSQL database to $DbBackupFile..."
    try {
        & pg_dump $env:DATABASE_URL -F c -f $DbBackupFile
        Write-Host "SUCCESS: PostgreSQL backup completed."
    } catch {
        Write-Error "ERROR: pg_dump failed: $_"
        exit 1
    }
} else {
    Write-Host "NOTICE: DATABASE_URL not set in environment. Skipping PostgreSQL dump."
}

# 2. LocalStore Snapshot Backup
$LocalStorePath = ".\.data\store.json"
if (Test-Path $LocalStorePath) {
    $StoreBackupFile = Join-Path $BackupDir "localstore_backup_${Timestamp}.json"
    Write-Host "Backing up localStore to $StoreBackupFile..."
    Copy-Item -Path $LocalStorePath -Destination $StoreBackupFile
    Write-Host "SUCCESS: LocalStore backup completed."
}

# 3. Retention policy cleanup
Write-Host "Cleaning up backups older than $RetentionDays days..."
$Cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $BackupDir -File | Where-Object { $_.LastWriteTime -lt $Cutoff } | Remove-Item -Force

Write-Host "================================================================="
Write-Host "Backup job finished successfully at $(Get-Date -Format s)."
Write-Host "================================================================="
