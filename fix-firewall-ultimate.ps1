# ============================================================
# POS Ultimate Firewall Fix — Run as Administrator
# ============================================================
# This script finds the EXACT node.exe and electron.exe
# being used by the POS system right now and completely
# allows them through the firewall for all networks.
# ============================================================

Write-Host "Finding running Node and Electron processes..." -ForegroundColor Cyan

# Find running Node.js process path
$nodeProcess = Get-Process node -ErrorAction SilentlyContinue | Select-Object -First 1
$electronProcess = Get-Process electron -ErrorAction SilentlyContinue | Select-Object -First 1

if ($nodeProcess -and $nodeProcess.Path) {
    Write-Host "Found Node: $($nodeProcess.Path)" -ForegroundColor Green
    # Remove old rules for this exact path
    netsh advfirewall firewall delete rule name="POS Node Allow" | Out-Null
    # Add new allow rule
    netsh advfirewall firewall add rule name="POS Node Allow" dir=in action=allow program="$($nodeProcess.Path)" enable=yes profile=any | Out-Null
    Write-Host "✅ Whitelisted Node.exe" -ForegroundColor Green
} else {
    Write-Host "⚠️ Could not find running node.exe. Is the POS app running?" -ForegroundColor Yellow
}

if ($electronProcess -and $electronProcess.Path) {
    Write-Host "Found Electron: $($electronProcess.Path)" -ForegroundColor Green
    # Remove old rules
    netsh advfirewall firewall delete rule name="POS Electron Allow" | Out-Null
    # Add new allow rule
    netsh advfirewall firewall add rule name="POS Electron Allow" dir=in action=allow program="$($electronProcess.Path)" enable=yes profile=any | Out-Null
    Write-Host "✅ Whitelisted Electron.exe" -ForegroundColor Green
} else {
    Write-Host "⚠️ Could not find running electron.exe." -ForegroundColor Yellow
}

# Also ensure the port rule is active
netsh advfirewall firewall delete rule name="POS Port 3001" | Out-Null
netsh advfirewall firewall add rule name="POS Port 3001" dir=in action=allow protocol=TCP localport=3001 enable=yes profile=any | Out-Null
Write-Host "✅ Whitelisted Port 3001" -ForegroundColor Green

Write-Host ""
Write-Host "SUCCESS: The exact executable paths have been allowed through the firewall." -ForegroundColor Cyan
Write-Host "Please test the connection on your phone again!" -ForegroundColor Yellow
Write-Host ""
pause
