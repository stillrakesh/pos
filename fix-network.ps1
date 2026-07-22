# Complete Network AND Firewall Fix Script for Restaurant POS System
# Run this script in PowerShell as Administrator

$ErrorActionPreference = "Continue"

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  RESTAURANT POS NETWORK AND FIREWALL FIX           " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

# 1. Set Wi-Fi network profile to Private
Write-Host "`n[1/4] Checking Network Category..." -ForegroundColor Yellow
try {
    $profiles = Get-NetConnectionProfile
    foreach ($profile in $profiles) {
        if ($profile.NetworkCategory -eq "Public") {
            Write-Host "      Changing $($profile.InterfaceAlias) ($($profile.Name)) from Public to Private..." -ForegroundColor Green
            Set-NetConnectionProfile -InterfaceAlias $profile.InterfaceAlias -NetworkCategory Private -ErrorAction SilentlyContinue
        } else {
            Write-Host "      $($profile.InterfaceAlias) ($($profile.Name)) is already $($profile.NetworkCategory)." -ForegroundColor Green
        }
    }
} catch {
    Write-Host "      Could not change network category: $_" -ForegroundColor Red
}

# 2. Clear old broken rules
Write-Host "`n[2/4] Removing Old / Broken Firewall Rules..." -ForegroundColor Yellow
$rulesToDelete = @("POS Port 3001", "POS Backend 3001", "Restaurant POS Server", "POS Ports 3100-3101", "Restaurant POS Node Server")
foreach ($ruleName in $rulesToDelete) {
    Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
}

# 3. Add explicit Inbound Rules for ports 3100, 3101, 3000, 5173, 5175 on ALL Profiles (Domain, Private, Public)
Write-Host "`n[3/4] Adding Firewall Inbound Rules for POS Ports (3100, 3101) on ALL Network Profiles..." -ForegroundColor Yellow

New-NetFirewallRule -DisplayName "Restaurant POS Ports (3100, 3101)" `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort 3100,3101,3000,5173,5175 `
    -Profile Any `
    -Enabled True `
    -Description "Allows incoming LAN connections to Restaurant POS Express server on ports 3100 and 3101." `
    -ErrorAction SilentlyContinue | Out-Null

Write-Host "      Added rule: Restaurant POS Ports (3100, 3101) (Profile: ANY)" -ForegroundColor Green

# 4. Add Program-Level Firewall Rules for Node.js AND Electron on ALL Profiles
Write-Host "`n[4/4] Adding Program Firewall Rules for Node.js and Electron (ANY Profile)..." -ForegroundColor Yellow

$nodePaths = @(
    "C:\Program Files\nodejs\node.exe",
    "$env:LOCALAPPDATA\Programs\node\node.exe"
)

# Find active node exes
foreach ($np in $nodePaths) {
    $found = Get-Item $np -ErrorAction SilentlyContinue
    if ($found) {
        New-NetFirewallRule -DisplayName "Restaurant POS - Node.exe (Any Profile)" `
            -Direction Inbound `
            -Action Allow `
            -Program $found.FullName `
            -Profile Any `
            -Enabled True `
            -ErrorAction SilentlyContinue | Out-Null
        Write-Host "      Added rule for: $($found.FullName)" -ForegroundColor Green
    }
}

Write-Host "`n====================================================" -ForegroundColor Cyan
Write-Host "  FIREWALL AND NETWORK CONFIGURATION COMPLETE!       " -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Cyan
