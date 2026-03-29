# VitalNoteAI — Local Android Build Script
# ==========================================
# Usage (run from project root in PowerShell):
#   .\build-local.ps1
#
# Why this exists:
#   'eas build --local' copies only git-tracked files to a Linux temp dir,
#   so .env (which is gitignored) never reaches the build environment.
#   This script reads .env directly and exports each key as a Windows
#   process-level env var BEFORE EAS runs — EAS then expands $GROQ_API_KEY
#   etc. from those exported values instead of passing them as literal strings.

Set-StrictMode -Off

$envPath = Join-Path $PSScriptRoot ".env"

if (-not (Test-Path $envPath)) {
    Write-Error ".env not found at $envPath — create it with GROQ_API_KEY and HF_API_TOKEN."
    exit 1
}

Write-Host "`n[build-local] Loading API keys from .env..." -ForegroundColor Cyan

Get-Content $envPath | ForEach-Object {
    $line = $_.Trim()
    # Skip blank lines and comments
    if (-not $line -or $line.StartsWith('#')) { return }
    if (-not $line.Contains('=')) { return }

    $idx   = $line.IndexOf('=')
    $key   = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1).Trim()

    # Strip surrounding single or double quotes
    $value = $value -replace '^[''"]|[''"]$', ''

    [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
    $preview = $value.Substring(0, [Math]::Min(7, $value.Length))
    Write-Host "[build-local] $key exported (len=$($value.Length), prefix=$preview)" -ForegroundColor Green
}

Write-Host "`n[build-local] Starting EAS local build...`n" -ForegroundColor Cyan
eas build -p android --profile preview --local
