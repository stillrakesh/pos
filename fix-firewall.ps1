# ============================================================
# POS Firewall Fix — Run this as Administrator (one-time)
# ============================================================
# This script opens port 3001 for ALL network profiles
# (Domain, Private, Public) so phones on the same WiFi
# can access the Captain App.
# ============================================================

Write-Host "Configuring Windows Firewall for POS Backend..." -ForegroundColor Cyan

# Remove any existing conflicting rules
netsh advfirewall firewall delete rule name="POS Backend 3001" | Out-Null

# Add new rule for ALL profiles (Domain, Private, Public)
netsh advfirewall firewall add rule `
  name="POS Backend 3001" `
  dir=in `
  action=allow `
  protocol=TCP `
  localport=3001 `
  profile=any `
  enable=yes

Write-Host ""
Write-Host "SUCCESS: Port 3001 is now open for all network types." -ForegroundColor Green
Write-Host "Your phone should now be able to access:" -ForegroundColor Green
Write-Host "  http://192.168.1.40:3001/captain/" -ForegroundColor Yellow
Write-Host ""
Write-Host "ALSO: Make sure your phone is on the SAME WiFi network." -ForegroundColor Cyan
Write-Host ""
pause
