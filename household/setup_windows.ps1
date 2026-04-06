# Household Management System — Windows Setup
# Run this once to get everything working.
# Right-click → "Run with PowerShell" OR open PowerShell and run:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\setup_windows.ps1

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Household Setup"

function Write-Header($text) {
    Write-Host ""
    Write-Host ("=" * 54) -ForegroundColor Cyan
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host ("=" * 54) -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step($text) {
    Write-Host "  >> $text" -ForegroundColor Yellow
}

function Write-OK($text) {
    Write-Host "  OK  $text" -ForegroundColor Green
}

function Write-Fail($text) {
    Write-Host "  !!  $text" -ForegroundColor Red
}

# ── Move to the household directory ──────────────────────────────────────────
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $scriptDir

Write-Header "Household Management System — Setup"
Write-Host "  This will install everything and start your dashboard."
Write-Host "  Takes about 2 minutes."
Write-Host ""

# ── 1. Check Python ───────────────────────────────────────────────────────────
Write-Step "Checking Python..."

$python = $null
foreach ($cmd in @("python", "python3", "py")) {
    try {
        $ver = & $cmd --version 2>&1
        if ($ver -match "Python 3") {
            $python = $cmd
            Write-OK "Found: $ver"
            break
        }
    } catch {}
}

if (-not $python) {
    Write-Fail "Python 3 not found."
    Write-Host ""
    Write-Host "  Please install Python from: https://python.org/downloads" -ForegroundColor White
    Write-Host "  IMPORTANT: tick 'Add Python to PATH' during install" -ForegroundColor Yellow
    Write-Host ""
    Start-Process "https://python.org/downloads"
    Read-Host "  Press Enter after installing Python, then re-run this script"
    exit 1
}

# ── 2. Install packages ───────────────────────────────────────────────────────
Write-Step "Installing Python packages..."
try {
    & $python -m pip install -r requirements.txt --quiet --disable-pip-version-check
    Write-OK "Packages installed (flask, anthropic, requests, google-api-python-client)"
} catch {
    Write-Fail "pip install failed: $_"
    Write-Host "  Try running: $python -m pip install -r requirements.txt" -ForegroundColor White
    exit 1
}

# ── 3. Pre-populate database ──────────────────────────────────────────────────
Write-Step "Setting up database with your emails..."

$dbExists = Test-Path "household.db"
if ($dbExists) {
    $count = & $python -c "import sqlite3; c=sqlite3.connect('household.db'); print(c.execute('SELECT COUNT(*) FROM documents').fetchone()[0])" 2>$null
    if ([int]$count -gt 0) {
        Write-OK "Database already has $count records — skipping"
    } else {
        & $python scanner.py --prepopulate
        Write-OK "Pre-populated 6 household records"
    }
} else {
    & $python scanner.py --prepopulate
    Write-OK "Pre-populated 6 household records"
}

# ── 4. Anthropic API key ──────────────────────────────────────────────────────
Write-Header "Claude AI — API Key"

$existingKey = $env:ANTHROPIC_API_KEY
if ($existingKey -and $existingKey.StartsWith("sk-ant-")) {
    Write-OK "ANTHROPIC_API_KEY already set"
} else {
    Write-Host "  You need an Anthropic API key for the Claude AI assistant." -ForegroundColor White
    Write-Host "  Get one free at: https://console.anthropic.com" -ForegroundColor Cyan
    Write-Host ""
    Start-Process "https://console.anthropic.com"
    $apiKey = Read-Host "  Paste your API key (sk-ant-...)"
    if ($apiKey -and $apiKey.StartsWith("sk-ant-")) {
        $env:ANTHROPIC_API_KEY = $apiKey

        # Save to a local .env file so start.bat picks it up
        $envLine = "ANTHROPIC_API_KEY=$apiKey"
        $envFile = ".env"
        if (Test-Path $envFile) {
            $content = Get-Content $envFile
            $content = $content | Where-Object { $_ -notmatch "^ANTHROPIC_API_KEY=" }
            $content += $envLine
            $content | Set-Content $envFile
        } else {
            $envLine | Set-Content $envFile
        }
        Write-OK "API key saved to .env"
    } else {
        Write-Fail "Invalid key — you can add it later. The dashboard will work without it except for the Ask Claude page."
    }
}

# ── 5. Obsidian vault ─────────────────────────────────────────────────────────
Write-Header "Obsidian Vault (optional)"

$defaultVault = "C:\Users\user\Projects\claude\home-automation\obsidian"
Write-Host "  Obsidian notes will be created at:" -ForegroundColor White
Write-Host "  $defaultVault" -ForegroundColor Cyan
Write-Host ""
$customVault = Read-Host "  Press Enter to use this path, or type a different one"
if ($customVault -and (Test-Path (Split-Path $customVault -Parent))) {
    $vaultPath = $customVault
} else {
    $vaultPath = $defaultVault
}

New-Item -ItemType Directory -Force -Path $vaultPath | Out-Null

# Save to .env
$envContent = ""
if (Test-Path ".env") { $envContent = Get-Content ".env" -Raw }
if ($envContent -notmatch "OBSIDIAN_VAULT=") {
    Add-Content ".env" "OBSIDIAN_VAULT=$vaultPath"
}
$env:OBSIDIAN_VAULT = $vaultPath
Write-OK "Vault: $vaultPath"

# ── 6. Banking setup ──────────────────────────────────────────────────────────
Write-Header "Banking (optional — skip to start dashboard)"

Write-Host "  Connect your bank accounts for live balances and transactions." -ForegroundColor White
Write-Host ""
Write-Host "  [1] Set up Starling Bank  (quickest — just a token)" -ForegroundColor White
Write-Host "  [2] Set up Monzo          (needs OAuth app at developers.monzo.com)" -ForegroundColor White
Write-Host "  [3] Set up NatWest        (sandbox only)" -ForegroundColor White
Write-Host "  [4] Skip — I'll do this later" -ForegroundColor White
Write-Host ""
$bankChoice = Read-Host "  Choose [1/2/3/4]"

switch ($bankChoice) {
    "1" {
        Write-Host ""
        Write-Host "  Opening Starling developer portal..." -ForegroundColor Cyan
        Start-Process "https://developer.starlingbank.com/personal/token"
        Write-Host "  Create a token with scopes: account:read  balance:read  feed:read" -ForegroundColor White
        Write-Host ""
        & $python setup_banking.py starling
    }
    "2" {
        Write-Host ""
        Write-Host "  Opening Monzo developer portal..." -ForegroundColor Cyan
        Start-Process "https://developers.monzo.com"
        Write-Host "  Create an OAuth client with redirect URI:" -ForegroundColor White
        Write-Host "  http://localhost:8765/oauth/callback/monzo" -ForegroundColor Yellow
        Write-Host ""
        & $python setup_banking.py monzo
    }
    "3" {
        Write-Host ""
        Write-Host "  Opening NatWest sandbox portal..." -ForegroundColor Cyan
        Start-Process "https://developer.sandbox.natwest.com"
        Write-Host ""
        & $python setup_banking.py natwest
    }
    default {
        Write-OK "Skipped — run 'python setup_banking.py' anytime to add banks"
    }
}

# ── 7. Create start.bat ───────────────────────────────────────────────────────
Write-Step "Creating start.bat launcher..."

$startBat = @"
@echo off
cd /d "%~dp0"

rem Load .env variables
if exist .env (
    for /f "tokens=1,2 delims==" %%a in (.env) do (
        set "%%a=%%b"
    )
)

echo.
echo  Starting Household Dashboard...
echo  Open http://localhost:5055 in your browser
echo.

start "" "http://localhost:5055"
python dashboard.py

pause
"@

$startBat | Set-Content "start.bat" -Encoding ASCII
Write-OK "start.bat created"

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Header "Setup Complete!"

Write-Host "  Your household dashboard is ready." -ForegroundColor Green
Write-Host ""
Write-Host "  TO START:" -ForegroundColor White
Write-Host "  Double-click  start.bat" -ForegroundColor Cyan
Write-Host "  Or run:       python dashboard.py" -ForegroundColor Cyan
Write-Host ""
Write-Host "  WHAT'S LOADED:" -ForegroundColor White
Write-Host "   6 household records (PayPal, E.ON, Octopus, Hyundai, McAfee)" -ForegroundColor White
Write-Host "   Claude AI assistant at /chat" -ForegroundColor White
Write-Host "   Document browser at /documents" -ForegroundColor White
if ($bankChoice -in @("1","2","3")) {
    Write-Host "   Banking page at /banking" -ForegroundColor White
}
Write-Host ""

$launch = Read-Host "  Launch the dashboard now? [Y/n]"
if ($launch -ne "n" -and $launch -ne "N") {
    Start-Process "http://localhost:5055"
    Write-Host ""
    Write-Host "  Starting... (press Ctrl+C in this window to stop)" -ForegroundColor Yellow
    Write-Host ""
    & $python dashboard.py
}
