# Bank Assets Migration Script
# Run this script after ensuring no dev server is running

Write-Host "Bank Assets Feature - Database Migration" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check for running Node processes
Write-Host "Checking for running Node.js processes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    Write-Host "WARNING: Found running Node.js processes!" -ForegroundColor Red
    Write-Host "Please stop the dev server before running migrations to avoid EPERM errors." -ForegroundColor Red
    Write-Host ""
    Write-Host "Running processes:" -ForegroundColor Yellow
    $nodeProcesses | Format-Table Id, ProcessName, StartTime -AutoSize
    Write-Host ""
    $response = Read-Host "Do you want to continue anyway? (y/N)"
    if ($response -ne 'y' -and $response -ne 'Y') {
        Write-Host "Migration cancelled." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
Write-Host "Running Prisma migration..." -ForegroundColor Green
pnpm prisma migrate dev --name add_bank_assets_models

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Migration completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Generating Prisma client..." -ForegroundColor Green
    pnpm prisma generate
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Database migration complete!" -ForegroundColor Green
        Write-Host "✓ Prisma client generated!" -ForegroundColor Green
        Write-Host ""
        Write-Host "You can now restart your dev server." -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "Error generating Prisma client." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host ""
    Write-Host "Error running migration." -ForegroundColor Red
    exit 1
}
