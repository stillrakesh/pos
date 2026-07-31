# ============================================================
# POS Ultimate Firewall Fix — Run as Administrator
# ============================================================
# This script finds the EXACT node.exe and electron.exe
# being used by the POS system right now and completely
# allows them through the firewall for all networks (Public & Private).
# ============================================================

Write-Host "Finding running Node and Electron processes..." -ForegroundColor Cyan

# Find running Node.js process path
$nodeProcess = Get-Process node -ErrorAction SilentlyContinue | Select-Object -First 1
$electronProcess = Get-Process electron -ErrorAction SilentlyContinue | Select-Object -First 1

if ($nodeProcess -and $nodeProcess.Path) {
    Write-Host "Found Node: $($nodeProcess.Path)" -ForegroundColor Green
    netsh advfirewall firewall delete rule name="POS Node Allow" | Out-Null
    netsh advfirewall firewall add rule name="POS Node Allow" dir=in action=allow program="$($nodeProcess.Path)" enable=yes profile=any | Out-Null
    Write-Host "✅ Whitelisted Node.exe" -ForegroundColor Green
} else {
    Write-Host "⚠️ Could not find running node.exe. Is the POS app running?" -ForegroundColor Yellow
}

if ($electronProcess -and $electronProcess.Path) {
    Write-Host "Found Electron: $($electronProcess.Path)" -ForegroundColor Green
    netsh advfirewall firewall delete rule name="POS Electron Allow" | Out-Null
    netsh advfirewall firewall add rule name="POS Electron Allow" dir=in action=allow program="$($electronProcess.Path)" enable=yes profile=any | Out-Null
    Write-Host "✅ Whitelisted Electron.exe" -ForegroundColor Green
} else {
    Write-Host "⚠️ Could not find running electron.exe." -ForegroundColor Yellow
}

# Ensure Ports 3101 & 5175 are allowed across ALL network profiles (Private & Public)
netsh advfirewall firewall delete rule name="POS Port 3101" | Out-Null
netsh advfirewall firewall add rule name="POS Port 3101" dir=in action=allow protocol=TCP localport=3101 enable=yes profile=any | Out-Null
Write-Host "✅ Whitelisted Port 3101 (Backend API & Socket.IO)" -ForegroundColor Green

netsh advfirewall firewall delete rule name="POS Port 5175" | Out-Null
netsh advfirewall firewall add rule name="POS Port 5175" dir=in action=allow protocol=TCP localport=5175 enable=yes profile=any | Out-Null
Write-Host "✅ Whitelisted Port 5175 (Vite Web App)" -ForegroundColor Green

Write-Host ""
Write-Host "SUCCESS: Firewall rules for Restaurant POS have been configured for Public & Private Wi-Fi." -ForegroundColor Cyan
Write-Host "Please test the Captain App on your iPhone/Android again!" -ForegroundColor Yellow
Write-Host ""
